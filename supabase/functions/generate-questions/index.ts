// Edge Function: generate-questions
// Recebe { kind: 'culture' | 'reasoning', notes? } e usa o JWT do HR pra resolver company_id.
// Lê dados da empresa (nome, descrição, cultura do DNA) e gera 5-8 perguntas
// padronizadas via Claude. NÃO persiste: a UI grava depois da aprovação.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Kind = 'culture' | 'reasoning';
type Payload = { kind: Kind; notes?: string };

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
  kind: Kind;
  companyName: string;
  companyDescription: string | null;
  companyCulture: string | null;
  notes: string | null;
}): string {
  const foco =
    args.kind === 'culture'
      ? `Perguntas abertas que medem ética de trabalho e fit cultural com ESTA empresa. Cada pergunta deve puxar uma resposta que revela como a pessoa trabalha de verdade, não o que ela acha bonito dizer. Evite perguntas que qualquer candidato responde igual. Ancore no que a cultura descrita valoriza (e no que reprova).`
      : `Perguntas de raciocínio lógico, padronizadas, iguais pra todo candidato. Medem clareza de pensamento, estruturação de problema e consistência. Não dependem da cultura da empresa: são neutras e comparáveis entre candidatos. Podem incluir situações práticas com trade-offs, priorização, ou lógica.`;

  const quantidade = args.kind === 'culture' ? '5 a 8' : '5 a 8';

  return `Você monta o banco de perguntas padrão que uma empresa vai usar no formulário de candidatura. Todo candidato responde as mesmas perguntas, então elas precisam ser boas e comparáveis.

EMPRESA: ${args.companyName}
O que fazem: ${args.companyDescription ?? '(não informado)'}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}
Notas de quem está montando: ${args.notes ?? '(nenhuma)'}

TIPO DE PERGUNTA: ${args.kind === 'culture' ? 'cultura e ética de trabalho' : 'raciocínio lógico'}
${foco}

Gere ${quantidade} perguntas. Para cada uma, entregue:
- "question": a pergunta que o candidato lê. Direta, em português, sem enrolação.
- "guidance": o que uma boa resposta demonstra (uso interno, o candidato não vê). Concreto.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno). Diga o que aprova, o que reprova, e onde fica a média. Ex: "0-40 resposta genérica sem exemplo; 41-70 tem exemplo mas raso; 71-100 exemplo concreto com resultado e reflexão".

REGRAS DE ESCRITA (valem pra question, guidance e scoring_rubric):
- Português direto. Sem clichê de RH ("trabalha bem em equipe", "é proativo", "veste a camisa").
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Concreto vence genérico. Pergunta que puxa exemplo real vence pergunta abstrata.
- Não repita a mesma pergunta com outras palavras. Cada uma cobre um ângulo diferente.

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

  if (payload.kind !== 'culture' && payload.kind !== 'reasoning') {
    return jsonResponse({ error: "kind obrigatório ('culture' | 'reasoning')" }, 400);
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

  const { data: company } = await admin
    .from('companies')
    .select('name, description, dna_document')
    .eq('id', companyId)
    .single();

  if (!company) return jsonResponse({ error: 'Empresa não encontrada' }, 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dnaDoc = (company.dna_document as any) ?? {};
  const cultureText = dnaDoc.culture ?? dnaDoc.culture_text ?? null;

  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const prompt = buildPrompt({
    kind: payload.kind,
    companyName: company.name ?? '',
    companyDescription: company.description ?? null,
    companyCulture: cultureText,
    notes: notes.length > 0 ? notes : null,
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
