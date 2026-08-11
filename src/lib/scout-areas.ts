// As 5 áreas do scout card. Mesmas chaves usadas pelo edge function
// analyze-candidate (dimensions) e pela tabela collaborator_scores (area).

export const SCOUT_AREAS = [
  { key: 'cultura', label: 'Cultura' },
  { key: 'execucao', label: 'Execução' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'motivacao', label: 'Motivação' },
  { key: 'potencial', label: 'Potencial' },
] as const;

export type ScoutAreaKey = (typeof SCOUT_AREAS)[number]['key'];

export type DimensionScore = {
  area: ScoutAreaKey;
  score: number;
  rationale?: string | null;
};

export function areaLabel(key: string): string {
  return SCOUT_AREAS.find((a) => a.key === key)?.label ?? key;
}

// Converte o jsonb dimensions de ai_analyses (com validação defensiva)
// no shape que o ScoutCard consome.
export function parseDimensions(raw: unknown): DimensionScore[] {
  if (!Array.isArray(raw)) return [];
  const byArea = new Map<string, DimensionScore>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { area, score, rationale } = item as Record<string, unknown>;
    if (typeof area !== 'string') continue;
    const n = typeof score === 'number' ? score : Number(score);
    if (Number.isNaN(n)) continue;
    byArea.set(area, {
      area: area as ScoutAreaKey,
      score: Math.max(0, Math.min(100, Math.round(n))),
      rationale: typeof rationale === 'string' ? rationale : null,
    });
  }
  return SCOUT_AREAS.filter((a) => byArea.has(a.key)).map((a) => byArea.get(a.key)!);
}

export function overallFromDimensions(dims: DimensionScore[]): number | null {
  if (dims.length === 0) return null;
  return Math.round(dims.reduce((sum, d) => sum + d.score, 0) / dims.length);
}
