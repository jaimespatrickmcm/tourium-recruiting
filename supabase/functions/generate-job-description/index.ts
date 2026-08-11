// Edge Function: generate-job-description
// Recebe { jobTitle } e usa o JWT do HR pra resolver company_id.
// Lê dados da empresa (nome, descrição, DNA) e gera descrição da vaga via Claude.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { jobTitle: string };

type ClaudeResponse = {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
};

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

Escreva uma descrição de vaga curta e direta (250-400 palavras) com esta estrutura, usando markdown leve:

**Sobre a posição**
2-3 frases sobre o que a pessoa vai fazer e o impacto que terá.

**O que você vai entregar**
- 4-6 bullets concretos. Resultado esperado, não atividade.

**O que esperamos de você**
- 4-5 bullets. Skills e experiência. Específico, não "ser proativo".

**Por que aqui**
2-3 frases honestas sobre a cultura e o momento da empresa. Use as palavras da cultura acima quando fizer sentido.

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
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }
  if (!anthropicKey) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY não configurada' }, 500);
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

  const model = 'claude-sonnet-4-6';
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonResponse({ error: `Anthropic ${response.status}: ${errText.slice(0, 300)}` }, 500);
    }

    const claudeData = (await response.json()) as ClaudeResponse;
    const description = claudeData.content?.[0]?.text?.trim() ?? '';
    if (!description) return jsonResponse({ error: 'IA retornou vazio' }, 500);

    return jsonResponse({ ok: true, description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
