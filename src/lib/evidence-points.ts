// Pontos fortes e pontos de atenção da análise (colunas jsonb strengths e
// concerns em ai_analyses). Cada item traz a leitura (point) e o que sustenta
// essa leitura (evidence: o que o candidato respondeu ou fez).
// Análises antigas não têm essas colunas preenchidas, então o parser é
// defensivo: qualquer formato inesperado vira lista vazia e a UI não renderiza.

export type EvidencePoint = {
  point: string;
  evidence: string;
};

export function parseEvidencePoints(raw: unknown): EvidencePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidencePoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { point, evidence } = item as Record<string, unknown>;
    if (typeof point !== 'string') continue;
    const trimmedPoint = point.trim();
    if (trimmedPoint.length === 0) continue;
    out.push({
      point: trimmedPoint,
      evidence: typeof evidence === 'string' ? evidence.trim() : '',
    });
  }
  return out;
}

// Feedback sobre o currículo (coluna jsonb cv_feedback em ai_analyses). É
// leitura do documento, não da pessoa: o que o currículo já comunica bem e o
// que mudaria a leitura de quem abre o arquivo. Fica nulo quando o candidato
// não anexou currículo e em análises antigas, então o parser é defensivo:
// formato inesperado ou conteúdo vazio vira null e a UI não renderiza nada.
export type CvFeedback = {
  strengths: string[];
  improvements: { point: string; why: string }[];
};

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    out.push(trimmed);
  }
  return out;
}

export function parseCvFeedback(raw: unknown): CvFeedback | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { strengths, improvements } = raw as Record<string, unknown>;

  const parsedStrengths = parseStringList(strengths);

  const parsedImprovements: CvFeedback['improvements'] = [];
  if (Array.isArray(improvements)) {
    for (const item of improvements) {
      if (!item || typeof item !== 'object') continue;
      const { point, why } = item as Record<string, unknown>;
      if (typeof point !== 'string') continue;
      const trimmedPoint = point.trim();
      if (trimmedPoint.length === 0) continue;
      parsedImprovements.push({
        point: trimmedPoint,
        why: typeof why === 'string' ? why.trim() : '',
      });
    }
  }

  if (parsedStrengths.length === 0 && parsedImprovements.length === 0) return null;
  return { strengths: parsedStrengths, improvements: parsedImprovements };
}

// Nota por pergunta (coluna jsonb question_scores em ai_analyses). Cada item
// amarra numa resposta pelo ref_id e traz a justificativa da nota. Análises
// antigas não têm a coluna preenchida, então o parser segue defensivo: formato
// inesperado vira lista vazia e a UI renderiza as respostas sem nota.
export type QuestionScore = {
  ref_id: string | null;
  score: number;
  rationale: string;
};

export function parseQuestionScores(raw: unknown): QuestionScore[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionScore[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { ref_id: refId, score, rationale } = item as Record<string, unknown>;
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    out.push({
      ref_id: typeof refId === 'string' && refId.trim().length > 0 ? refId.trim() : null,
      score: Math.round(Math.min(100, Math.max(0, score))),
      rationale: typeof rationale === 'string' ? rationale.trim() : '',
    });
  }
  return out;
}

function clampScore(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

function trimmedString(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

// De onde vem o potencial (coluna jsonb potential_breakdown em ai_analyses).
// São os componentes por trás da nota de potencial, e potencial é PROJEÇÃO de
// quanto a pessoa ainda cresce, não o nível dela hoje.
//   aquisicao  = o que ela foi atrás de aprender por conta própria
//   trajetoria = escopo ganho por tempo de carreira (inclinação, não altura);
//                vem null pra estagiário sem histórico de trabalho
//   reflexao   = consegue nomear o que errou e o que tirou dali
//   raciocinio = estrutura problema novo
// Análises antigas não têm a coluna, então o parser é defensivo: formato
// inesperado ou conteúdo vazio vira null e a UI não renderiza o bloco.
export const POTENTIAL_COMPONENTS = [
  { key: 'aquisicao', label: 'Aquisição' },
  { key: 'trajetoria', label: 'Trajetória' },
  { key: 'reflexao', label: 'Reflexão' },
  { key: 'raciocinio', label: 'Raciocínio' },
] as const;

export type PotentialComponentKey = (typeof POTENTIAL_COMPONENTS)[number]['key'];

export type PotentialComponent = {
  key: PotentialComponentKey;
  label: string;
  score: number | null;
  evidence: string;
};

export function parsePotentialBreakdown(raw: unknown): PotentialComponent[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: PotentialComponent[] = [];
  for (const { key, label } of POTENTIAL_COMPONENTS) {
    const item = obj[key];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const { score, evidence } = item as Record<string, unknown>;
    const parsedScore = clampScore(score);
    const parsedEvidence = trimmedString(evidence);
    // Componente sem nota e sem evidência não diz nada: fora.
    if (parsedScore === null && parsedEvidence.length === 0) continue;
    out.push({ key, label, score: parsedScore, evidence: parsedEvidence });
  }
  return out.length > 0 ? out : null;
}

// Sinal de liderança (coluna jsonb leadership_signal em ai_analyses).
// ATENÇÃO: isto não é nota e nunca pode virar uma. Não entra em média, não
// ranqueia candidato e não aparece como déficit. Muita gente excelente não quer
// liderar, e tratar isso como falta seria injusto.
//   level  = evidência de capacidade de liderança
//   intent = o que a pessoa DIZ que quer, que é outra coisa
// O caso interessante é capacidade alta com interesse baixo: essa pessoa se
// desenvolve como referência técnica, não empurrada pra gestão.
export type LeadershipLevel = 'sem' | 'moderado' | 'forte';
export type LeadershipIntent = 'alto' | 'medio' | 'baixo' | 'nao_declarado';

export type LeadershipSignal = {
  level: LeadershipLevel;
  evidence: string[];
  intent: LeadershipIntent;
  intent_evidence: string;
};

const LEADERSHIP_LEVELS: LeadershipLevel[] = ['sem', 'moderado', 'forte'];
const LEADERSHIP_INTENTS: LeadershipIntent[] = ['alto', 'medio', 'baixo', 'nao_declarado'];

export const LEADERSHIP_LEVEL_LABELS: Record<LeadershipLevel, string> = {
  sem: 'sem sinal',
  moderado: 'moderado',
  forte: 'forte',
};

export const LEADERSHIP_INTENT_LABELS: Record<LeadershipIntent, string> = {
  alto: 'alto',
  medio: 'médio',
  baixo: 'baixo',
  nao_declarado: 'não declarado',
};

export function parseLeadershipSignal(raw: unknown): LeadershipSignal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { level, evidence, intent, intent_evidence: intentEvidence } = raw as Record<
    string,
    unknown
  >;

  const parsedLevel =
    typeof level === 'string' && (LEADERSHIP_LEVELS as string[]).includes(level)
      ? (level as LeadershipLevel)
      : null;
  const parsedIntent =
    typeof intent === 'string' && (LEADERSHIP_INTENTS as string[]).includes(intent)
      ? (intent as LeadershipIntent)
      : null;

  // Sem nenhum dos dois enums válidos não há sinal nenhum pra mostrar.
  if (parsedLevel === null && parsedIntent === null) return null;

  return {
    level: parsedLevel ?? 'sem',
    evidence: parseStringList(evidence),
    intent: parsedIntent ?? 'nao_declarado',
    intent_evidence: trimmedString(intentEvidence),
  };
}
