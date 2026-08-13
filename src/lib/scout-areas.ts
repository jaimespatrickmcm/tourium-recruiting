// As 6 áreas do scout card. Mesmas chaves usadas pelo edge function
// analyze-candidate (SCOUT_AREAS / dimensions) e pela tabela
// collaborator_scores (area). A ordem aqui é a ordem de leitura na UI e no
// radar, então precisa bater com a do edge function.

export const SCOUT_AREAS = [
  { key: 'cultura', label: 'Cultura' },
  { key: 'execucao', label: 'Execução' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'raciocinio', label: 'Raciocínio' },
  { key: 'motivacao', label: 'Motivação' },
  { key: 'potencial', label: 'Potencial' },
] as const;

export type ScoutAreaKey = (typeof SCOUT_AREAS)[number]['key'];

export type DimensionScore = {
  area: ScoutAreaKey;
  score: number;
  rationale?: string | null;
};

// Áreas específicas do scout por etapa (stage_dimensions). As de CV avaliam o
// currículo contra a vaga. Raciocínio também vive aqui porque aparece na etapa
// de formulário; o rótulo é o mesmo do scout geral.
export const STAGE_AREA_LABELS: Record<string, string> = {
  experiencia: 'Experiência',
  estabilidade: 'Estabilidade',
  aderencia_tecnica: 'Aderência técnica',
  disponibilidade: 'Disponibilidade',
  localizacao: 'Localização',
  raciocinio: 'Raciocínio',
};

export function areaLabel(key: string): string {
  return SCOUT_AREAS.find((a) => a.key === key)?.label ?? STAGE_AREA_LABELS[key] ?? key;
}

export type StageDimension = {
  area: string;
  score: number | null;
  rationale: string | null;
};

// Converte o jsonb stage_dimensions de ai_analyses (com validação defensiva).
// Itens com score null são MANTIDOS: significam "sem dados" (ex.: datas
// ilegíveis no currículo) e a UI mostra isso em vez de esconder.
export function parseStageDimensions(raw: unknown): StageDimension[] {
  if (!Array.isArray(raw)) return [];
  const out: StageDimension[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { area, score, rationale } = item as Record<string, unknown>;
    if (typeof area !== 'string' || area.length === 0) continue;
    let normalized: number | null = null;
    if (typeof score === 'number' && Number.isFinite(score)) {
      normalized = Math.max(0, Math.min(100, Math.round(score)));
    }
    out.push({
      area,
      score: normalized,
      rationale: typeof rationale === 'string' ? rationale : null,
    });
  }
  return out;
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
