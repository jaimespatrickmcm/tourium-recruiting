// Skills do candidato, com a evidência e a etapa de onde cada uma veio.
//
// A leitura que isso permite não é "quais skills ela tem", é "o que ela DISSE
// que sabe e o que ela MOSTROU". Skill que aparece só no currículo é declaração;
// a mesma skill confirmada no formulário ou na entrevista é outra coisa. Por
// isso a etapa aparece em cada linha, e não só o nome.

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { invokeEdge } from '@/lib/functions';
import { cn } from '@/lib/utils';

type CandidateSkill = {
  id: string;
  skill_id: string | null;
  name: string;
  kind: string;
  level: number | null;
  source: string;
  evidence: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  cv: 'Currículo',
  form: 'Formulário',
  interview: 'Entrevista',
};

// Currículo é o mais fraco de propósito: ali a pessoa só declara.
const SOURCE_TONE: Record<string, string> = {
  cv: 'bg-surface-sunken text-ink-subtle',
  form: 'bg-canvas text-ink-muted',
  interview: 'bg-positive-tint text-positive',
};

type Grouped = {
  name: string;
  kind: string;
  inCatalog: boolean;
  best: number | null;
  entries: CandidateSkill[];
};

function groupByName(rows: CandidateSkill[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const r of rows) {
    const key = r.name.toLowerCase();
    const g = map.get(key) ?? {
      name: r.name,
      kind: r.kind,
      inCatalog: false,
      best: null,
      entries: [],
    };
    g.entries.push(r);
    g.inCatalog = g.inCatalog || r.skill_id !== null;
    if (r.level !== null && (g.best === null || r.level > g.best)) g.best = r.level;
    map.set(key, g);
  }
  // Mais confirmações primeiro, depois nível: skill vista em duas etapas
  // interessa mais que skill vista numa só, mesmo com nível igual.
  return [...map.values()].sort(
    (a, b) => b.entries.length - a.entries.length || (b.best ?? 0) - (a.best ?? 0),
  );
}

export function CandidateSkills({
  applicationId,
  companyId,
}: {
  applicationId: string;
  companyId: string;
}) {
  const [rows, setRows] = useState<CandidateSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('candidate_skills')
      .select('id, skill_id, name, kind, level, source, evidence')
      .eq('application_id', applicationId);
    setRows((data ?? []) as CandidateSkill[]);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function mapSkills() {
    setMapping(true);
    try {
      const { error } = await invokeEdge('map-candidate-skills', { applicationId, companyId });
      if (error) throw error;
      await load();
      toast.success('Skills mapeadas.');
    } catch {
      toast.error('Não deu pra mapear agora. Tente de novo.');
    } finally {
      setMapping(false);
    }
  }

  const hard = groupByName(rows.filter((r) => r.kind === 'hard'));
  const soft = groupByName(rows.filter((r) => r.kind === 'soft'));

  if (loading) return <p className="text-caption text-ink-subtle">Carregando skills...</p>;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-caption text-ink-muted">
          {rows.length === 0
            ? 'Nada mapeado ainda.'
            : 'A etapa ao lado de cada skill diz se ela foi só declarada ou confirmada depois.'}
        </p>
        <button
          type="button"
          onClick={() => void mapSkills()}
          disabled={mapping}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-footnote font-semibold text-ink transition-colors duration-200 hover:bg-canvas disabled:opacity-50"
        >
          {mapping ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          )}
          {rows.length === 0 ? 'Mapear skills' : 'Atualizar'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-caption text-ink-subtle">
          O mapeamento lê o currículo, as respostas do formulário e as anotações da entrevista.
          Quanto mais etapas o candidato tiver percorrido, mais completo ele fica.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {[
            { titulo: 'Hard skills', lista: hard },
            { titulo: 'Soft skills', lista: soft },
          ].map(
            (bloco) =>
              bloco.lista.length > 0 && (
                <div key={bloco.titulo}>
                  <p className="mb-2 text-eyebrow font-bold uppercase text-ink-subtle">
                    {bloco.titulo}
                  </p>
                  <div className="flex flex-col gap-2">
                    {bloco.lista.map((g) => (
                      <div
                        key={g.name}
                        className="rounded-tile border border-line-soft bg-surface px-3.5 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-callout font-semibold text-ink">{g.name}</span>
                          {g.best !== null && (
                            <span className="text-caption tabular-nums text-ink-muted">
                              nível {g.best}
                            </span>
                          )}
                          {g.entries.map((e) => (
                            <span
                              key={e.id}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-eyebrow font-bold uppercase',
                                SOURCE_TONE[e.source] ?? 'bg-canvas text-ink-muted',
                              )}
                            >
                              {SOURCE_LABEL[e.source] ?? e.source}
                            </span>
                          ))}
                          {/* Skill fora do catálogo da empresa. Vale saber: na
                              contratação ela não carrega sozinha. */}
                          {!g.inCatalog && (
                            <span className="text-caption text-ink-subtle">fora do catálogo</span>
                          )}
                        </div>
                        {g.entries.map(
                          (e) =>
                            e.evidence && (
                              <p key={`ev-${e.id}`} className="mt-1 text-caption leading-snug text-ink-muted">
                                <span className="text-ink-subtle">
                                  {SOURCE_LABEL[e.source] ?? e.source}:
                                </span>{' '}
                                {e.evidence}
                              </p>
                            ),
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
