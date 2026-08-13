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
