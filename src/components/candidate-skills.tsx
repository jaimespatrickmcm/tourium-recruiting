// Skills do candidato: badge por skill, evidência ao abrir.
//
// A leitura que isso precisa permitir não é "quais skills ela tem", é "o que ela
// DISSE que sabe e o que ela MOSTROU". Por isso cada badge carrega o nível e as
// etapas onde a skill apareceu, e a evidência fica a um clique em vez de
// empilhada na tela: com 8 skills por pessoa, mostrar toda evidência de uma vez
// vira parede de texto e ninguém lê nenhuma.

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
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

const SOURCE_SHORT: Record<string, string> = { cv: 'CV', form: 'Form', interview: 'Entrev' };

type Grouped = {
  name: string;
  kind: string;
  inCatalog: boolean;
  best: number;
  entries: CandidateSkill[];
};

function groupByName(rows: CandidateSkill[]): Grouped[] {
  const map = new Map<string, Grouped>();
  for (const r of rows) {
    const key = r.name.toLowerCase();
    const g = map.get(key) ?? { name: r.name, kind: r.kind, inCatalog: false, best: 0, entries: [] };
    g.entries.push(r);
    g.inCatalog = g.inCatalog || r.skill_id !== null;
    if ((r.level ?? 0) > g.best) g.best = r.level ?? 0;
    map.set(key, g);
  }
  // Confirmada em mais etapas primeiro, depois nível: skill vista duas vezes
  // vale mais que skill vista uma vez com o mesmo nível.
  return [...map.values()].sort(
    (a, b) => b.entries.length - a.entries.length || b.best - a.best,
  );
}

// Nível vira pontinhos em vez de barra: a badge é pequena, e cinco pontos se
// leem de relance sem ocupar largura.
function LevelDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nível ${level} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn('h-1 w-1 rounded-full', i <= level ? 'bg-ink' : 'bg-line')}
          aria-hidden
        />
      ))}
    </span>
  );
}

function SkillBadge({ group }: { group: Grouped }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        'rounded-full border transition-colors duration-200',
        open ? 'w-full rounded-tile border-line bg-surface' : 'border-line-soft bg-surface',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
      >
        <span className="text-footnote font-semibold text-ink">{group.name}</span>
        {group.best > 0 && <LevelDots level={group.best} />}
        <span className="text-eyebrow font-bold uppercase text-ink-subtle">
          {group.entries.map((e) => SOURCE_SHORT[e.source] ?? e.source).join(' · ')}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-ink-subtle transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-line-soft px-3 py-2.5">
          {group.entries.map((e) => (
            <p key={e.id} className="mb-1.5 text-caption leading-snug text-ink-muted last:mb-0">
              <span className="font-semibold text-ink-subtle">
                {SOURCE_LABEL[e.source] ?? e.source}
                {e.level ? ` · nível ${e.level}` : ''}:
              </span>{' '}
              {e.evidence}
            </p>
          ))}
          {!group.inCatalog && (
            <p className="mt-2 text-caption text-ink-subtle">
              Fora do catálogo da empresa. Não vai junto se a pessoa for contratada.
            </p>
          )}
        </div>
      )}
    </div>
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="max-w-md text-caption leading-snug text-ink-muted">
          {rows.length === 0
            ? 'Nada mapeado ainda. O mapeamento lê o currículo, as respostas e as anotações da entrevista.'
            : 'A etiqueta diz de onde veio cada skill. Só CV é declaração; confirmada no formulário ou na entrevista é outra coisa. Toque para ver a evidência.'}
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
          {rows.length === 0 ? 'Mapear' : 'Atualizar'}
        </button>
      </div>

      {rows.length > 0 && (
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
                    <span className="ml-1.5 tabular-nums text-ink-subtle">
                      {bloco.lista.length}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-start gap-1.5">
                    {bloco.lista.map((g) => (
                      <SkillBadge key={g.name} group={g} />
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
