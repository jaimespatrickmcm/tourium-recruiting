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
