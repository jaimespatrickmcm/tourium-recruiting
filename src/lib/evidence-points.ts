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
