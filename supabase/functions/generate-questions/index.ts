// Edge Function: generate-questions
// Gera a seção de CULTURA + RACIOCÍNIO do formulário (unificada) via OpenAI.
// kind: 'culture' | 'reasoning' | 'mixed'. mode: 'noren' (adapta o método Noren
// ao cliente) | 'scratch' (gera do zero). NÃO persiste: a UI grava após aprovar.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callOpenAI } from '../_shared/openai.ts';

type Kind = 'profile' | 'culture' | 'reasoning' | 'curiosity';
// O payload do modal segue 'culture' | 'reasoning' | 'mixed'. 'culture' cobre
// as seções da pessoa (profile + culture + curiosity); 'reasoning' só o raciocínio.
type GenKind = 'culture' | 'reasoning' | 'mixed';
type Mode = 'noren' | 'scratch';
type Payload = { kind: GenKind; mode?: Mode; notes?: string };

type QuestionFormat = 'text' | 'number' | 'single_select' | 'multi_select';

type GeneratedQuestion = {
  kind: Kind;
  question: string;
  guidance: string;
  scoring_rubric: string;
  format: QuestionFormat;
  options: string[] | null;
  required: boolean;
};

const MODEL = 'gpt-5';

// Método Noren: base fixa de perguntas já aplicadas em processo real.
// O texto, formato, opções e obrigatoriedade são fixos; guidance e rubrica são
// sempre calibrados pelo DNA do cliente. `intent` orienta essa calibragem.
type NorenBaseQuestion = {
  kind: Kind;
  question: string;
  format: QuestionFormat;
  options?: string[];
  required: boolean;
  intent: string;
};

const NOREN_BASE: NorenBaseQuestion[] = [
  // ---- SOBRE O CANDIDATO (profile): informação, história e triagem ----
  {
    kind: 'profile',
    question: 'Conte um pouco da sua história. Como você chegou até aqui?',
    format: 'text',
    required: true,
    intent: 'trajetória, autoconhecimento e clareza narrativa',
  },
  {
    kind: 'profile',
    question: 'Cite uma conquista da qual você tem orgulho e o motivo.',
    format: 'text',
    required: true,
    intent: 'o que a pessoa considera vitória e o papel dela na conquista',
  },
  {
    kind: 'profile',
    question: 'Conte sobre uma vez em que você assumiu um risco e falhou. O que aprendeu?',
    format: 'text',
    required: true,
    intent: 'relação com fracasso, ownership e aprendizado',
  },
  {
    kind: 'profile',
    question: 'Qual seu maior sonho ainda não realizado?',
    format: 'text',
    required: false,
    intent: 'ambição e o que move a pessoa',
  },
  {
    kind: 'profile',
    question: 'Onde você quer estar daqui a 3 anos?',
    format: 'text',
    required: true,
    intent: 'aspiração e aderência do plano da pessoa ao que a empresa oferece',
  },
  {
    kind: 'profile',
    question: 'Quantos anos de experiência você tem na área dessa vaga?',
    format: 'number',
    required: true,
    intent: 'informativo de triagem: comparar com o nível da vaga, não pontua',
  },
  {
    kind: 'profile',
    question: 'Qual foi o seu último salário? Se ainda estiver trabalhando, pode colocar o atual.',
    format: 'number',
    required: true,
    intent:
      'informativo de triagem: checar se o candidato cabe na faixa salarial da vaga, não pontua',
  },
  {
    kind: 'profile',
    question: 'Qual regime de contrato você prefere?',
    format: 'multi_select',
    options: ['PJ', 'CLT'],
    required: true,
    intent: 'informativo de triagem: compatibilidade com o regime que a empresa oferece',
  },
  {
    kind: 'profile',
    question: 'Onde você ficou sabendo dessa vaga?',
    format: 'single_select',
    options: ['LinkedIn', 'Indicação', 'Anúncio', 'Site da empresa', 'Outro'],
    required: true,
    intent: 'informativo de sourcing: de onde vêm os candidatos, não pontua',
  },
  // ---- CULTURA: estilo de pensamento e fit ----
  {
    kind: 'culture',
    question:
      'O que você faria se seu gestor te pedisse uma tarefa de um jeito com o qual você não concorda?',
    format: 'text',
    required: true,
    intent: 'autonomia, comunicação e como lida com discordância',
  },
  {
    kind: 'culture',
    question: 'Quem são suas 3 maiores referências na sua área profissional?',
    format: 'text',
    required: false,
    intent: 'repertório e em quem a pessoa se espelha profissionalmente',
  },
  {
    kind: 'culture',
    question: 'Em quem você pensa quando falo em: pessoa inteligente? Não vale você mesmo.',
    format: 'text',
    required: false,
    intent: 'o que a pessoa entende por inteligência revela o que ela valoriza e persegue',
  },
  // ---- CURIOSIDADE: o quanto a pessoa aprende sozinha e se interessa ----
  {
    kind: 'curiosity',
    question:
      'O que você aprendeu recentemente por conta própria, sem ninguém pedir? Como você foi atrás?',
    format: 'text',
    required: true,
    intent:
      'curiosidade genuína e iniciativa de aprendizado: especificidade do tema e do caminho valem mais que o assunto em si',
  },
  {
    kind: 'curiosity',
    question: 'Sobre o que você consegue falar por meia hora sem preparar nada?',
    format: 'text',
    required: false,
    intent: 'profundidade de interesse real em algum tema, qualquer tema',
  },
  {
    kind: 'reasoning',
    question:
      'Quantos passageiros chegam no aeroporto internacional de Guarulhos em uma quinta-feira à tarde? Não existe resposta certa. Explique como chegou nesse número.',
    format: 'text',
    required: true,
    intent: 'estimativa de Fermi: avaliar a estruturação do raciocínio, não o número final',
  },
  {
    kind: 'reasoning',
    question:
      'Um hotel ofereceu um desconto de 10% em uma diária, mas não conseguiu vendê-la. Na semana seguinte, aplicou um desconto de 20% sobre esse novo preço, e a diária foi vendida por R$ 108,00. Qual era o preço original da diária?',
    format: 'single_select',
    options: ['R$ 120,00', 'R$ 130,00', 'R$ 150,00', 'R$ 160,00', 'R$ 180,00'],
    required: true,
    intent: 'matemática com pegadinha de desconto composto. A resposta certa é R$ 150,00',
  },
  {
    kind: 'reasoning',
    question:
      'Como você conseguiria mais clientes se fosse criar uma barraca de limonada na rua da sua casa?',
    format: 'text',
    required: true,
    intent: 'senso de negócio e criatividade prática',
  },
];

function baseLine(q: NorenBaseQuestion): string {
  const i = NOREN_BASE.indexOf(q);
  const opts = q.options ? ` | options: ${JSON.stringify(q.options)}` : '';
  return `- [base_index: ${i} | kind: ${q.kind} | format: ${q.format}${opts} | required: ${q.required}] "${q.question}" (mede: ${q.intent})`;
}

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

  const regrasEscrita = `REGRAS DE ESCRITA (valem pra question, guidance, scoring_rubric e options):
- Português direto. Sem clichê de RH ("trabalha bem em equipe", "é proativo", "veste a camisa").
- Sem travessão de nenhum tipo. Use só vírgula, ponto, dois-pontos, hífen simples ou parênteses.
- Sem "basicamente", "simplesmente", "definitivamente", "literalmente".
- Concreto vence genérico. Pergunta que puxa exemplo real vence pergunta abstrata.
- Não repita a mesma pergunta com outras palavras.
- Opções de seleção curtas, sem frase inteira.`;

  const schema = `OUTPUT: somente JSON, nenhum texto antes ou depois. Schema:
{
  "questions": [
    { "kind": "profile" | "culture" | "curiosity" | "reasoning", "question": "<texto>", "guidance": "<texto>", "scoring_rubric": "<texto>", "format": "text" | "number" | "single_select" | "multi_select", "options": ["<opção>", "..."] | null, "required": true | false, "base_index": <número, só nas perguntas da base fixa> }
  ]
}
Cada item traz o "kind" correto. "options" só existe (2 a 12 itens) quando format é single_select ou multi_select; nos outros formatos é null. "base_index" só existe nas perguntas da base fixa do método Noren.`;

  const categorias = `As perguntas se dividem em 4 categorias (campo "kind"):
- "profile" (Sobre o candidato): informação e história da pessoa, mais dados de triagem (experiência, salário, regime, origem). Não mede fit por si; a rubrica diz o que a resposta informa pro avaliador e contra o que comparar.
- "culture" (Cultura): estilo de pensamento, valores e fit com ESTA empresa. É onde a mesma resposta pontua diferente conforme a cultura.
- "curiosity" (Curiosidade): o quanto a pessoa é curiosa, aprende por conta própria e se aprofunda no que gosta. Rubrica premia especificidade e iniciativa genuína, não o tema escolhido.
- "reasoning" (Raciocínio lógico): raciocínio puro, neutro e comparável entre candidatos.`;

  const norenPersonBase = NOREN_BASE.filter((q) => q.kind !== 'reasoning');
  const norenReasoningBase = NOREN_BASE.filter((q) => q.kind === 'reasoning');

  const blocoCultura = wantCulture
    ? args.mode === 'noren'
      ? `SEÇÕES SOBRE O CANDIDATO + CULTURA + CURIOSIDADE (método Noren):
Cultura NÃO é sobre segmento, produto ou experiência no ramo. É soft skill, caráter, valores e ética de trabalho: como a pessoa pensa, lida com fracasso, o que a move, o quanto assume responsabilidade.
O método Noren tem uma base fixa, testada em processo real. Reproduza CADA pergunta abaixo incluindo o "base_index" indicado. Seu trabalho nelas é escrever guidance e scoring_rubric calibrados pela cultura DESTA empresa (o campo "mede" diz a intenção); question, kind, format, options e required serão fixados pelo sistema a partir do base_index:
${norenPersonBase.map(baseLine).join('\n')}
Nas perguntas informativas de profile (experiência, salário, regime, origem da vaga), a rubrica deve dizer com clareza que a resposta NÃO pontua: serve de triagem (comparar com o nível, a faixa salarial e o regime da vaga) e entra como contexto pro avaliador.

Depois da base, gere MAIS DUAS perguntas de kind "culture":
- Uma multi_select de calibração de mentalidade: "Com qual dessas pessoas você mais se identifica?" com 10 a 12 figuras públicas amplamente conhecidas no Brasil, required true, cobrindo mentalidades bem diferentes entre si: alta performance e execução, criatividade e arte, ciência, ativismo social ou ambiental, disciplina e filosofia, empreendedorismo, esporte, e visões políticas de lados opostos. A rubrica é o coração dessa pergunta: diga quais escolhas indicam fit forte com ESTA cultura, quais são neutras e quais indicam anti-fit, e como pontuar combinações mistas. Escolhas de anti-fit não são "erradas", são sinal de que a pessoa rende mais em outro tipo de empresa.
- Uma pergunta aberta extra (format text) no mesmo estilo pessoal do método, que revele o que ESTA cultura mais valoriza.
`
      : `SEÇÕES SOBRE O CANDIDATO + CULTURA + CURIOSIDADE (geradas do zero):
Gere 3 perguntas de kind "profile" (história, conquista, fracasso e aprendizado, aspiração), 3 de kind "culture" pessoais e abertas (cenários de comportamento como discordar do gestor ou receber feedback duro, referências), e 1 a 2 de kind "curiosity" (aprendizado por conta própria, profundidade de interesse). Calibradas ao que ESTA cultura valoriza e reprova, mas genéricas quanto ao negócio: são sobre a pessoa.
Além das abertas, gere 1 pergunta multi_select de kind "culture" de calibração de mentalidade ("Com qual dessas pessoas você mais se identifica?", 10 a 12 figuras públicas conhecidas no Brasil, de mentalidades bem diferentes entre si) com rubrica dizendo quais escolhas indicam fit, neutro e anti-fit pra ESTA cultura.
`
    : '';

  const blocoRaciocinio = wantReasoning
    ? args.mode === 'noren'
      ? `SEÇÃO RACIOCÍNIO (método Noren, kind "reasoning"):
Neutras, comparáveis, não dependem da cultura nem do segmento. Medem clareza de pensamento, não acertar um número. Reproduza CADA pergunta abaixo incluindo o "base_index" indicado e escrevendo guidance e scoring_rubric (nas de seleção, a rubrica diz qual é a alternativa certa e como pontuar erro):
${norenReasoningBase.map(baseLine).join('\n')}
Não gere perguntas de raciocínio além dessas.
`
      : `SEÇÃO RACIOCÍNIO (kind "reasoning"):
Neutras, comparáveis, não dependem da cultura nem do segmento. Medem clareza de pensamento e estruturação, não acertar um número. Gere 2 a 3 perguntas variando os tipos: estimativa de Fermi (ex "quantos passageiros chegam em Guarulhos numa quinta à tarde, explique como chegou", format text), matemática com pegadinha (desconto composto, proporção, velocidade; pode ser single_select com 5 alternativas e a certa indicada na rubrica) e senso de negócio (ex "como conseguir mais clientes numa barraca de limonada na sua rua", format text). Nas abertas, peça pra pessoa explicar o raciocínio.
`
    : '';

  return `Você monta o formulário de candidatura de uma empresa. Todo candidato responde as mesmas perguntas. Sem exagerar na quantidade: o formulário também tem perguntas técnicas, então cultura e raciocínio juntos ficam enxutos.

EMPRESA (serve pra calibrar a PONTUAÇÃO, não o enunciado):
Nome: ${args.companyName}
Cultura (nas palavras deles): ${args.companyCulture ?? '(não informado)'}
Notas de quem está montando: ${args.notes ?? '(nenhuma)'}

${categorias}

${blocoCultura}${blocoRaciocinio}
Para CADA pergunta entregue:
- "kind": "profile", "culture", "curiosity" ou "reasoning".
- "question": o enunciado que o candidato lê.
- "guidance": o que uma boa resposta demonstra (uso interno). Concreto.
- "scoring_rubric": como pontuar de 0 a 100 (uso interno). Em cultura, CALIBRE PELA CULTURA DESTA EMPRESA (a mesma pergunta pontua diferente conforme o que a empresa valoriza). Diga o que aprova, o que reprova e onde fica a média. Em pergunta de seleção com resposta certa, diga qual é. Em pergunta informativa, diga que não pontua e o que o avaliador deve comparar.
- "format": "text" (aberta), "number" (numérica), "single_select" (uma opção) ou "multi_select" (várias opções).
- "options": array de opções quando o format é de seleção; null nos outros.
- "required": true se o candidato não pode pular.

${regrasEscrita}

${schema}`;
}

const FORMATS: QuestionFormat[] = ['text', 'number', 'single_select', 'multi_select'];

function normalizeFormat(value: unknown): QuestionFormat {
  return FORMATS.includes(value as QuestionFormat) ? (value as QuestionFormat) : 'text';
}

function normalizeOptions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const opts = Array.from(
    new Set(value.map((o) => String(o ?? '').trim()).filter((o) => o.length > 0)),
  ).slice(0, 12);
  return opts.length >= 2 ? opts : null;
}

type ParsedQuestion = GeneratedQuestion & { baseIndex: number | null };

function parseQuestions(text: string, fallbackKind: Kind): ParsedQuestion[] | null {
  const cleaned = text.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const raw = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions: ParsedQuestion[] = raw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => {
        let format = normalizeFormat(q?.format);
        const options = normalizeOptions(q?.options);
        // Seleção sem opções válidas vira pergunta aberta em vez de quebrar o form.
        if ((format === 'single_select' || format === 'multi_select') && !options) {
          format = 'text';
        }
        const kindOk =
          q?.kind === 'profile' ||
          q?.kind === 'culture' ||
          q?.kind === 'reasoning' ||
          q?.kind === 'curiosity';
        return {
          kind: kindOk ? (q.kind as Kind) : fallbackKind,
          question: String(q?.question ?? '').trim(),
          guidance: String(q?.guidance ?? '').trim(),
          scoring_rubric: String(q?.scoring_rubric ?? '').trim(),
          format,
          options: format === 'single_select' || format === 'multi_select' ? options : null,
          required: q?.required === true,
          baseIndex: Number.isInteger(q?.base_index) ? (q.base_index as number) : null,
        };
      })
      .filter((q: ParsedQuestion) => q.question.length > 0);
    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

// A base Noren é fixa por definição: a IA só contribui guidance e rubrica.
// question, kind, format, options e required são sobrescritos daqui pelo
// base_index, e item da base que a IA não devolveu entra mesmo assim (com
// critério em branco, editável na revisão). Um eco parafraseado ou uma opção
// alterada nunca chega ao formulário.
function enforceNorenBase(
  parsed: ParsedQuestion[],
  wantCulture: boolean,
  wantReasoning: boolean,
): GeneratedQuestion[] {
  const byIndex = new Map<number, ParsedQuestion>();
  const extras: GeneratedQuestion[] = [];
  for (const p of parsed) {
    const { baseIndex, ...q } = p;
    if (
      baseIndex !== null &&
      baseIndex >= 0 &&
      baseIndex < NOREN_BASE.length &&
      !byIndex.has(baseIndex)
    ) {
      byIndex.set(baseIndex, p);
    } else {
      extras.push(q);
    }
  }
  const base: GeneratedQuestion[] = NOREN_BASE.map((q, i) => ({ q, i }))
    .filter(({ q }) => (q.kind === 'reasoning' ? wantReasoning : wantCulture))
    .map(({ q, i }) => ({
      kind: q.kind,
      question: q.question,
      guidance: byIndex.get(i)?.guidance ?? '',
      scoring_rubric: byIndex.get(i)?.scoring_rubric ?? '',
      format: q.format,
      options: q.options ?? null,
      required: q.required,
    }));
  return [...base, ...extras];
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
      maxTokens: 9000,
      jsonMode: true,
      reasoningEffort: 'medium',
    });
    const fallbackKind: Kind = kind === 'reasoning' ? 'reasoning' : 'culture';
    const parsed = parseQuestions(text, fallbackKind);
    if (!parsed) return jsonResponse({ error: 'IA retornou formato inválido' }, 500);

    const wantCulture = kind === 'culture' || kind === 'mixed';
    const wantReasoning = kind === 'reasoning' || kind === 'mixed';
    const questions =
      mode === 'noren'
        ? enforceNorenBase(parsed, wantCulture, wantReasoning)
        : parsed.map(({ baseIndex: _baseIndex, ...q }) => q);

    return jsonResponse({ ok: true, questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return jsonResponse({ error: message }, 500);
  }
});
