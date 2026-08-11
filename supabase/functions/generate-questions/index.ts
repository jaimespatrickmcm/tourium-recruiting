// Edge Function: generate-questions
// Gera a seção de CULTURA + RACIOCÍNIO do formulário (unificada) via OpenAI.
// kind: 'culture' | 'reasoning' | 'mixed'. mode: 'noren' (adapta o método Noren
// ao cliente) | 'scratch' (gera do zero). NÃO persiste: a UI grava após aprovar.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Kind = 'culture' | 'reasoning';
type GenKind = Kind | 'mixed';
type Mode = 'noren' | 'scratch';
type Payload = { kind: GenKind; mode?: Mode; notes?: string };

type GeneratedQuestion = {
  kind: Kind;
  question: string;
  guidance: string;
  scoring_rubric: string;
};

const MODEL = 'gpt-5';

// Método Noren: perguntas de cultura já aplicadas, pessoais e universais.
// O texto é fixo; a rubrica é sempre calibrada pelo DNA do cliente.
const NOREN_CULTURE_BASE = [
  'Conte um pouco da sua história. Como você chegou até aqui?',
  'Cite uma conquista da qual você tem orgulho e o motivo.',
  'Conte sobre uma vez em que você assumiu um risco e falhou. O que aprendeu?',
  'Onde você quer estar daqui a 3 anos?',
];

// Cenário comportamental do método Noren: revela autonomia, comunicação e ownership.
const NOREN_BEHAVIORAL =
  'O que você faria se seu gestor te pedisse uma tarefa de um jeito com o qual você não concorda?';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPrompt(args: {
  kind: GenKind;
  mode: Mode;
  companyName: string;
  companyCulture: string | null;
  notes: string | null;
}): string {
  const wantCulture = args.kind === 'culture' || args.kind === 'mixed';
  const wantReasoning = args.kind === 'reasoning' || args.kind === 'mixed';

  const regrasEscrita = `REGRAS DE ESCRITA (valem pra question, guidance e scoring_rubric):
- Português direto. Sem clichê de RH ("trabalha bem em equipe", "é proativo", "veste a camisa").
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Concreto vence genérico. Pergunta que puxa exemplo real vence pergunta abstrata.
- Não repita a mesma pergunta com outras palavras.`;

  const schema = `OUTPUT: somente JSON, nenhum texto antes ou depois. Schema:
{
  "questions": [
    { "kind": "culture" | "reasoning", "question": "<texto>", "guidance": "<texto>", "scoring_rubric": "<texto>" }
  ]
}
Cada item traz o "kind" correto (culture ou reasoning).`;

  const blocoCultura = wantCulture
    ? args.mode === 'noren'
      ? `SEÇÃO CULTURA (método Noren, kind "culture"):
Cultura NÃO é sobre segmento, produto ou experiência no ramo. É soft skill, caráter, valores e ética de trabalho: como a pessoa pensa, lida com fracasso, o que a move, o quanto assume responsabilidade. Perguntas pessoais e abertas.
Comece com estas perguntas-base do método Noren, MANTENDO O TEXTO:
${NOREN_CULTURE_BASE.map((q, i) => `   ${i + 1}. ${q}`).join('\n')}
Inclua também este cenário comportamental, MANTENDO O TEXTO:
   ${NOREN_CULTURE_BASE.length + 1}. ${NOREN_BEHAVIORAL}
Depois gere 1 pergunta de cultura extra, no mesmo estilo pessoal, que revele o que ESTA cultura valoriza.
`
      : `SEÇÃO CULTURA (gerada do zero, kind "culture"):
Cultura é soft skill, caráter, valores e ética de trabalho, não segmento nem hard skill. Gere 4 perguntas pessoais e abertas (história, conquista, fracasso e aprendizado, aspiração, cenários de comportamento como discordar do gestor ou receber feedback duro), calibradas ao que ESTA cultura valoriza e reprova. Continuam genéricas quanto ao negócio: são sobre a pessoa.
`
    : '';

  const blocoRaciocinio = wantReasoning
    ? `SEÇÃO RACIOCÍNIO (kind "reasoning"):
Neutras, comparáveis, não dependem da cultura nem do segmento. Medem clareza de pensamento e estruturação, não acertar um número. Gere 2 perguntas variando os tipos: estimativa de Fermi (ex "quantos passageiros chegam em Guarulhos numa quinta à tarde, explique como chegou"), matemática com pegadinha (desconto composto, proporção, velocidade) e senso de negócio (ex "como conseguir mais clientes numa barraca de limonada na sua rua"). Peça pra pessoa explicar o raciocínio.
`
    : '';

  return `Você monta o formulário de candidatura de uma empresa. Todo candidato responde as mesmas perguntas. Sem exagerar na quantidade: o formulário também tem perguntas técnicas, então cultura e raciocínio juntos ficam enxutos.

EMPRESA (serve pra calibrar a PONTUAÇÃO, não o enunciado):
Nome: ${args.companyName}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}
Notas de quem está montando: ${args.notes ?? '(nenhuma)'}

${blocoCultura}${blocoRaciocinio}
Para CADA pergunta entregue:
- "kind": "culture" ou "reasoning".
- "question": o enunciado que o candidato lê.
- "guidance": o que uma boa resposta demonstra (uso interno). Concreto.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno). Em cultura, CALIBRE PELA CULTURA DESTA EMPRESA (a mesma pergunta pontua diferente conforme o que a empresa valoriza). Diga o que aprova, o que reprova e onde fica a média.

${regrasEscrita}

${schema}`;
}

function parseQuestions(text: string, fallbackKind: Kind): GeneratedQuestion[] | null {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions: GeneratedQuestion[] = raw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        kind: q?.kind === 'reasoning' || q?.kind === 'culture' ? q.kind : fallbackKind,
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

  const kind: GenKind = payload.kind;
  if (kind !== 'culture' && kind !== 'reasoning' && kind !== 'mixed') {
    return jsonResponse({ error: "kind obrigatório ('culture' | 'reasoning' | 'mixed')" }, 400);
  }
  const mode: Mode = payload.mode === 'scratch' ? 'scratch' : 'noren';

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
    .select('name, dna_document')
    .eq('id', companyId)
    .single();

  if (!company) return jsonResponse({ error: 'Empresa não encontrada' }, 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dnaDoc = (company.dna_document as any) ?? {};
  const cultureText = dnaDoc.culture ?? dnaDoc.culture_text ?? null;

  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
  const prompt = buildPrompt({
    kind,
    mode,
    companyName: company.name ?? '',
    companyCulture: cultureText,
    notes: notes.length > 0 ? notes : null,
  });

  try {
    const { text } = await callOpenAI({
      apiKey: openaiKey,
      model: MODEL,
      prompt,
      maxTokens: 6000,
      jsonMode: true,
      reasoningEffort: 'medium',
    });
    const fallbackKind: Kind = kind === 'reasoning' ? 'reasoning' : 'culture';
    const questions = parseQuestions(text, fallbackKind);
    if (!questions) return jsonResponse({ error: 'IA retornou formato inválido' }, 500);

    return jsonResponse({ ok: true, questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
