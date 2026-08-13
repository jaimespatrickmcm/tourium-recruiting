// Edge Function: generate-job-description
// Recebe { jobTitle } e usa o JWT do HR pra resolver company_id.
// Lê dados da empresa (nome, descrição, DNA) e gera descrição da vaga via Claude.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Payload = { jobTitle: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(args: {
  companyName: string;
  companyDescription: string | null;
  companyCulture: string | null;
  jobTitle: string;
}): string {
  return `Você escreve descrições de vaga em português pra uma empresa específica. Use o tom e os valores da empresa, não escreva genérico.

EMPRESA: ${args.companyName}
O que fazem: ${args.companyDescription ?? '(não informado)'}
Cultura: ${args.companyCulture ?? '(não informado)'}

VAGA: ${args.jobTitle}

Escreva uma descrição de vaga curta e direta (250-450 palavras) em seções. Cada seção começa com um título markdown de nível 2 (duas cerquilhas e um espaço, exatamente como abaixo). O candidato lê cada seção separada, então cada uma tem que fazer sentido sozinha.

## Sobre a vaga
2-3 frases sobre o que a pessoa vai fazer e o impacto que terá.

## O que você vai fazer
- 4-6 bullets concretos, começando com hífen. Resultado esperado, não atividade.

## O que esperamos de você
- 4-5 bullets, começando com hífen. Skills e experiência. Específico, não "ser proativo".

## Sobre a empresa
2-3 frases honestas sobre o que a empresa faz, a cultura e o momento dela. Use as palavras da cultura acima quando fizer sentido.

NÃO escreva seção de benefícios. Os benefícios são cadastrados à parte, como itens, e a career page mostra sozinha quando a vaga está configurada pra isso. Se você escrever aqui, o candidato vê duplicado.

REGRAS DE FORMATO:
- Título de seção: sempre "## Título", nunca com asteriscos.
- Bullets: sempre "- item" no começo da linha.
- Negrito só dentro de frase, com dois asteriscos de cada lado, e com moderação.
- Uma linha em branco entre seções.

REGRAS:
- Português direto. Sem clichê de RH ("oportunidade única", "ambiente dinâmico", "queremos pessoas apaixonadas").
- Sem em-dash (—) ou en-dash (–). Use vírgula, ponto ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente".
- Concreto > genérico. "Vai liderar a migração do monolito Rails pra microserviços Go" vence "vai trabalhar com tecnologia de ponta".
- Tom do candidato, não tom de anúncio. Frases curtas misturadas com médias.

OUTPUT: somente o markdown da descrição. Nenhum texto antes ou depois.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  if (!payload.jobTitle || payload.jobTitle.trim().length < 3) {
    return jsonResponse({ error: 'jobTitle obrigatório (mínimo 3 chars)' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }
  if (!openaiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY não configurada' }, 500);
  }

  // Resolve company_id from JWT via public.users
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'JWT inválido' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  const companyId = userRow?.company_id;
  if (!companyId) return jsonResponse({ error: 'Usuário sem empresa vinculada' }, 403);

  const { data: company } = await admin
    .from('companies')
    .select('name, description, dna_document')
    .eq('id', companyId)
    .single();

  if (!company) return jsonResponse({ error: 'Empresa não encontrada' }, 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dnaDoc = (company.dna_document as any) ?? {};
  const cultureText = dnaDoc.culture ?? dnaDoc.culture_text ?? null;

  const prompt = buildPrompt({
    companyName: company.name ?? '',
    companyDescription: company.description ?? null,
    companyCulture: cultureText,
    jobTitle: payload.jobTitle.trim(),
  });

  try {
    const { text } = await callOpenAI({
      apiKey: openaiKey,
      model: 'gpt-5',
      prompt,
      maxTokens: 3000,
      reasoningEffort: 'low',
    });
    const description = text.trim();
    if (!description) return jsonResponse({ error: 'IA retornou vazio' }, 500);

    return jsonResponse({ ok: true, description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
