// Edge Function: generate-job-requirements
// Recebe { jobId } e usa o JWT do HR pra resolver company_id.
// Confere que a vaga pertence à empresa, lê título + descrição da vaga e a
// cultura da empresa, e gera um PERFIL DE REQUISITOS INTERNO da vaga via OpenAI.
// Esse gabarito é uso interno (o candidato nunca vê) e serve pra (1) gerar as
// perguntas da vaga e (2) pontuar cada candidato contra o que a vaga exige.
// NÃO persiste: a UI grava em jobs.requirements depois da revisão.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Payload = { jobId: string };

type JobRequirements = {
  seniority: string;
  location: string;
  summary: string;
  must_have: string[];
  nice_to_have: string[];
  responsibilities: string[];
  evaluation_focus: string[];
  red_flags: string[];
};

const MODEL = 'gpt-5';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(args: {
  companyName: string;
  companyCulture: string | null;
  jobTitle: string;
  jobDescription: string | null;
}): string {
  return `Você define o PERFIL DE REQUISITOS INTERNO de uma vaga. Isso é uso interno da empresa: o candidato NUNCA vê. Serve de gabarito pra (1) gerar as perguntas da vaga e (2) pontuar cada candidato contra o que a vaga realmente exige.

EMPRESA: ${args.companyName}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}

VAGA: ${args.jobTitle}
Descrição e exigências: ${args.jobDescription ?? '(não informado)'}

PASSO 1, CALIBRE A SENIORIDADE pelo título e pela descrição (estágio, júnior, pleno, sênior, liderança). Os requisitos mudam com o nível. Estágio ou júnior NÃO exige anos de experiência, portfólio de campanhas pagas nem liderança: foca em fundamentos, familiaridade básica com as ferramentas, vontade de aprender e como a pessoa pensa. Sênior ou liderança pede autonomia, decisões difíceis e impacto amplo. Não peça de um estágio o que se pede de um sênior.

PASSO 2, EXTRAIA os requisitos REAIS da vaga a partir do que a descrição sustenta. Não invente exigência que a descrição não dá base. Seja específico da vaga, não genérico que serve pra qualquer cargo.

PASSO 2B, MUST-HAVE É CAPACIDADE, NUNCA MÉTODO, FRAMEWORK OU FERRAMENTA. Esse é o erro mais caro que você pode cometer aqui: um must-have escrito como método faz o sistema cortar gente excelente que faz a mesma coisa com outro nome.
- Errado: "liderança de ciclo de OKRs com KRs e backlog priorizado por squad". Certo: "definir metas de negócio, desdobrar em indicadores por área e manter uma cadência de acompanhamento que corrige rota".
- Errado: "modelagem de CAC, LTV, payback". Certo: "modelar o impacto econômico de uma decisão e defender com números (a métrica muda conforme o negócio: margem, DRE, ticket, prazo médio, CAC, o que for)".
- Errado: "fluência em SQL". Certo: "autonomia pra tirar dado e montar análise que responde pergunta de negócio (SQL, BI, planilha, o que a pessoa dominar)".
Regra: se o item cita o NOME de uma metodologia (OKR, Scrum, PDCA, 5W2H), de uma métrica de um setor específico (CAC, LTV, GMV) ou de uma ferramenta (SQL, Jira, Salesforce), reescreva pela capacidade. O nome pode aparecer entre parênteses como exemplo, nunca como exigência. Métodos e ferramentas específicos vão em nice_to_have.

PASSO 3, NÃO TRANSFORME O SETOR EM REQUISITO. A vaga é pra atuar DENTRO da empresa; o que a empresa vende é contexto, não é a função do candidato. E boa parte dos bons candidatos vem de outro mercado, trazendo a competência junto. Então:
- Escreva os must-have como COMPETÊNCIA, não como setor. "Construir indicador que sustenta decisão" em vez de "experiência com jornada digital de hotelaria".
- Só coloque experiência no setor específico como must-have se a descrição disser com todas as letras que é obrigatório. Se for só desejável, vai em nice-to-have.
- Ferramenta e método podem ser específicos. Setor, não.

Entregue JSON com estes campos:
- "seniority": um de estagio, junior, pleno, senior, lideranca. Use exatamente essas palavras, sem termo em inglês: "lead" em português de negócio significa prospect e confunde numa vaga comercial.
- "location": local e modelo de trabalho da vaga, extraído do título/descrição (ex.: "Presencial em Belo Horizonte", "Remoto", "Híbrido em São Paulo"). Se a descrição não diz, string vazia. Não invente local.
- "summary": 1 a 2 frases do que a vaga precisa de fato.
- "must_have": 3 a 6 competências obrigatórias, calibradas ao nível. O que a pessoa PRECISA ter pra dar conta.
- "nice_to_have": 0 a 4 diferenciais que ajudam mas não são obrigatórios.
- "responsibilities": 3 a 6 coisas que a pessoa vai fazer no dia a dia.
- "evaluation_focus": 3 a 5 pontos do que MAIS pesa ao avaliar um candidato pra ESTA vaga.
- "red_flags": 2 a 4 sinais de anti-fit, técnico ou cultural.

REGRAS DE ESCRITA:
- Português direto, sem clichê de RH.
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Cada item específico e acionável, não frase-ônibus.

OUTPUT: somente JSON, nenhum texto antes ou depois. Schema:
{
  "seniority": "<nivel>",
  "location": "<local e modelo, ou vazio>",
  "summary": "<texto>",
  "must_have": ["<item>"],
  "nice_to_have": ["<item>"],
  "responsibilities": ["<item>"],
  "evaluation_focus": ["<item>"],
  "red_flags": ["<item>"]
}`;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0);
}

function parseRequirements(text: string): JobRequirements | null {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const requirements: JobRequirements = {
      seniority: String(parsed?.seniority ?? '').trim(),
      location: String(parsed?.location ?? '').trim(),
      summary: String(parsed?.summary ?? '').trim(),
      must_have: toStringArray(parsed?.must_have),
      nice_to_have: toStringArray(parsed?.nice_to_have),
      responsibilities: toStringArray(parsed?.responsibilities),
      evaluation_focus: toStringArray(parsed?.evaluation_focus),
      red_flags: toStringArray(parsed?.red_flags),
    };
    // Precisa ter pelo menos resumo ou must_have pra valer.
    if (!requirements.summary && requirements.must_have.length === 0) return null;
    return requirements;
  } catch {
    return null;
  }
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

  if (!payload.jobId || typeof payload.jobId !== 'string') {
    return jsonResponse({ error: 'jobId obrigatório' }, 400);
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

  const { data: job } = await admin
    .from('jobs')
    .select('id, company_id, title, description')
    .eq('id', payload.jobId)
    .maybeSingle();

  if (!job) return jsonResponse({ error: 'Vaga não encontrada' }, 404);
  if (job.company_id !== companyId) return jsonResponse({ error: 'Vaga não pertence à empresa' }, 403);

  const { data: company } = await admin
    .from('companies')
    .select('name, dna_document')
    .eq('id', companyId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dnaDoc = (company?.dna_document as any) ?? {};
  const cultureText = dnaDoc.culture ?? dnaDoc.culture_text ?? null;

  const prompt = buildPrompt({
    companyName: company?.name ?? '',
    companyCulture: cultureText,
    jobTitle: job.title ?? '',
    jobDescription: job.description ?? null,
  });

  try {
    const { text } = await callOpenAI({
      apiKey: openaiKey,
      model: MODEL,
      prompt,
      maxTokens: 3000,
      jsonMode: true,
      reasoningEffort: 'medium',
    });
    const requirements = parseRequirements(text);
    if (!requirements) return jsonResponse({ error: 'IA retornou formato inválido' }, 500);

    return jsonResponse({ ok: true, requirements });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
