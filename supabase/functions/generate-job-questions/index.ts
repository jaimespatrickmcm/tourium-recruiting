// Edge Function: generate-job-questions
// Recebe { jobId } e usa o JWT do HR pra resolver company_id.
// Confere que a vaga pertence à empresa, lê título + descrição da vaga e a
// cultura da empresa, e gera 4-6 perguntas técnicas específicas da vaga via
// Claude. NÃO persiste: a UI grava depois da aprovação.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Payload = { jobId: string };

type GeneratedQuestion = {
  question: string;
  guidance: string;
  scoring_rubric: string;
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
  return `Você monta as perguntas técnicas de UMA vaga. Todo candidato dessa vaga responde as mesmas perguntas.

EMPRESA: ${args.companyName}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}

VAGA: ${args.jobTitle}
Descrição e exigências: ${args.jobDescription ?? '(não informado)'}

PASSO 1, CALIBRE A SENIORIDADE. Antes de escrever, deduza o nível da vaga pelo título e pela descrição (estágio, júnior, pleno, sênior, lead). Isso mude TUDO:
- Estágio / júnior: a pessoa está começando ou na faculdade. NÃO peça anos de experiência profissional, portfólio de campanhas pagas, biblioteca de assets pro time, decks de venda do zero ou liderança. Foque em fundamentos, curiosidade, projetos pequenos ou acadêmicos, familiaridade básica com as ferramentas, vontade de aprender e como a pessoa pensa. Perguntas que um bom estagiário consegue responder com o que já viveu.
- Pleno: experiência prática real, autonomia em tarefas, decisões do dia a dia.
- Sênior / lead: arquitetura, trade-offs difíceis, mentoria, impacto amplo.
Uma pergunta boa pra sênior costuma ser injusta pra estagiário. Ajuste a profundidade ao nível.

PASSO 2, GERE 3 a 5 perguntas (menos é melhor: o formulário todo já tem perguntas de cultura também, então não pese a mão). Misture:
- Perguntas técnicas calibradas ao nível da vaga (ferramentas, decisões, como resolveu algo concreto no nível dela).
- Pelo menos 1 cenário comportamental que também revela cultura, no estilo "o que você faria se seu gestor te pedisse uma tarefa do jeito que você discorda?" ou "conte uma vez que recebeu um feedback duro, o que fez". Esses medem autonomia, comunicação, humildade e ownership, além do lado técnico.

Para cada pergunta, entregue:
- "question": o enunciado que o candidato lê. Direto, português, no nível certo da vaga.
- "guidance": o que uma boa resposta demonstra (uso interno). Concreto: ferramenta, raciocínio ou trade-off no nível da vaga.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno). Avalie DOIS eixos juntos: (a) fit técnico com a exigência da vaga no nível certo e (b) o sinal cultural/soft-skill que a resposta revela (calibrado pela cultura desta empresa). Diga o que aprova, o que reprova e onde fica a média.

REGRAS DE ESCRITA (valem pra question, guidance e scoring_rubric):
- Português direto. Sem clichê de RH.
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Específico da vaga e do nível, não pergunta que serve pra qualquer cargo.
- Não repita a mesma pergunta com outras palavras.

OUTPUT: somente JSON, nenhum texto antes ou depois. Schema:
{
  "questions": [
    { "question": "<texto>", "guidance": "<texto>", "scoring_rubric": "<texto>" }
  ]
}`;
}

function parseQuestions(text: string): GeneratedQuestion[] | null {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions: GeneratedQuestion[] = raw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        question: String(q?.question ?? '').trim(),
        guidance: String(q?.guidance ?? '').trim(),
        scoring_rubric: String(q?.scoring_rubric ?? '').trim(),
      }))
      .filter((q: GeneratedQuestion) => q.question.length > 0);
    return questions.length > 0 ? questions : null;
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
      maxTokens: 5000,
      jsonMode: true,
      reasoningEffort: 'medium',
    });
    const questions = parseQuestions(text);
    if (!questions) return jsonResponse({ error: 'IA retornou formato inválido' }, 500);

    return jsonResponse({ ok: true, questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
