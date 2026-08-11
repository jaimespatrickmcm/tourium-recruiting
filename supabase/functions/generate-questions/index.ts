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

// Perguntas-base do método Noren pra seção de cultura: pessoais, universais,
// de caráter e soft skill. O texto é fixo; a rubrica é calibrada pelo DNA.
const NOREN_CULTURE_BASE = [
  'Conte um pouco da sua história. Como você chegou até aqui?',
  'Cite uma conquista da qual você tem orgulho e o motivo.',
  'Conte sobre uma vez em que você assumiu um risco e falhou. O que aprendeu?',
  'Onde você quer estar daqui a 3 anos?',
];

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
  const regrasEscrita = `REGRAS DE ESCRITA (valem pra question, guidance e scoring_rubric):
- Português direto. Sem clichê de RH ("trabalha bem em equipe", "é proativo", "veste a camisa").
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Concreto vence genérico. Pergunta que puxa exemplo real vence pergunta abstrata.
- Não repita a mesma pergunta com outras palavras. Cada uma cobre um ângulo diferente.`;

  const schema = `OUTPUT: somente JSON, nenhum texto antes ou depois. Schema:
{
  "questions": [
    { "question": "<texto>", "guidance": "<texto>", "scoring_rubric": "<texto>" }
  ]
}`;

  if (args.kind === 'culture') {
    return `Você monta a seção de CULTURA do formulário de candidatura de uma empresa. Todo candidato responde as mesmas perguntas.

CONCEITO (leia com atenção): cultura NÃO é sobre o segmento, o produto ou a experiência da pessoa no ramo. Cultura é sobre SOFT SKILLS, caráter, valores e ética de trabalho: como a pessoa pensa, como lida com fracasso, o que a move, o quanto assume responsabilidade, como se projeta. As perguntas são PESSOAIS e ABERTAS, no estilo "conte sua história", "cite uma conquista e por quê", "conte uma vez que você falhou e o que aprendeu", "onde você quer estar daqui a 3 anos". Nada de perguntas técnicas ou sobre o mercado da empresa.

EMPRESA (só pra calibrar a PONTUAÇÃO, não o enunciado das perguntas):
Nome: ${args.companyName}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}
Notas de quem está montando: ${args.notes ?? '(nenhuma)'}

Monte a lista assim:
1) Comece com estas perguntas-base do método Noren, MANTENDO O TEXTO delas (elas são universais e pessoais):
${NOREN_CULTURE_BASE.map((q, i) => `   ${i + 1}. ${q}`).join('\n')}
2) Depois, gere mais 2 perguntas de cultura NO MESMO ESTILO (pessoais, abertas, de caráter e valores), que ajudem a revelar o que ESTA cultura em específico valoriza e reprova. Continuam genéricas quanto ao segmento: são sobre a pessoa, não sobre o negócio.

Para CADA pergunta (as base e as novas), escreva:
- "question": o enunciado que o candidato lê (para as base, repita o texto acima).
- "guidance": o que uma boa resposta demonstra (uso interno). Concreto.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno), CALIBRADO PELA CULTURA DESTA EMPRESA. A mesma pergunta pontua diferente conforme o que esta empresa valoriza. Diga o que aprova, o que reprova e onde fica a média. Ex numa cultura que preza ownership: "0-40 terceiriza a culpa do fracasso; 41-70 assume mas sem tirar lição; 71-100 assume com clareza e mostra o que mudou depois".

${regrasEscrita}

${schema}`;
  }

  return `Você monta a seção de RACIOCÍNIO LÓGICO do formulário de candidatura. Iguais pra todo candidato, neutras, comparáveis. NÃO dependem da cultura nem do segmento da empresa.

O que medem: clareza de pensamento, estruturação de problema, consistência e senso prático. O que importa é o RACIOCÍNIO até a resposta, não acertar um número exato.

Gere 4 a 6 perguntas variando os tipos:
- Estimativa (Fermi): ex "quantos passageiros chegam em Guarulhos numa quinta à tarde? Explique como chegou no número".
- Matemática com pegadinha: ex desconto composto, proporção, velocidade.
- Senso de negócio: ex "como você conseguiria mais clientes numa barraca de limonada na sua rua?".

Para cada pergunta, entregue:
- "question": o enunciado. Direto, em português. Quando fizer sentido, peça pra pessoa explicar o raciocínio.
- "guidance": o que uma boa resposta demonstra (uso interno). Concreto: que estrutura de raciocínio você espera ver.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno). O que aprova, o que reprova, onde fica a média. Ex: "0-40 chuta sem explicar; 41-70 estrutura mas com furo lógico; 71-100 quebra o problema em partes e justifica cada passo".

${regrasEscrita}

${schema}`;
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
