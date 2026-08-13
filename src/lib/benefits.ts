// Benefícios da empresa. São itens estruturados (não texto livre) pra ficarem
// pesquisáveis e comparáveis entre empresas. Moram em
// companies.dna_document.benefits e a vaga decide se exibe (jobs.show_benefits).

/** Catálogo pra escolher com um clique. A empresa pode adicionar os próprios. */
export const BENEFIT_CATALOG: { group: string; items: string[] }[] = [
  {
    group: 'Saúde',
    items: [
      'Plano de saúde',
      'Plano odontológico',
      'Seguro de vida',
      'Apoio psicológico',
      'Gympass ou Wellhub',
    ],
  },
  {
    group: 'Alimentação',
    items: ['Vale refeição', 'Vale alimentação', 'Refeição no local'],
  },
  {
    group: 'Trabalho',
    items: [
      'Trabalho remoto',
      'Modelo híbrido',
      'Horário flexível',
      'Vale transporte',
      'Auxílio home office',
      'Equipamento fornecido',
    ],
  },
  {
    group: 'Tempo e família',
    items: [
      'Day off no aniversário',
      'Férias flexíveis',
      'Licença parental estendida',
      'Auxílio creche',
    ],
  },
  {
    group: 'Carreira e ganhos',
    items: [
      'PLR ou bônus',
      'Participação societária',
      'Auxílio educação',
      'Mentoria interna',
      'Plano de carreira estruturado',
    ],
  },
];

const ALL_CATALOG_ITEMS = BENEFIT_CATALOG.flatMap((g) => g.items);

export function isCustomBenefit(item: string): boolean {
  return !ALL_CATALOG_ITEMS.includes(item);
}

/** Lê a lista do dna_document com validação defensiva (o jsonb é solto). */
export function parseBenefits(dnaDocument: unknown): string[] {
  if (!dnaDocument || typeof dnaDocument !== 'object') return [];
  const raw = (dnaDocument as Record<string, unknown>).benefits;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of raw) {
    const item = String(value ?? '').trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item.slice(0, 80));
  }
  return items;
}
