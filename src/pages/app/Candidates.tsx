// Visao cross-vaga de candidatos.
//
// Era o item de nav desabilitado apontando pra "#". Os dados sempre existiram,
// so estavam presos dentro do JobDetail — o recrutador precisava saber em qual
// vaga procurar antes de conseguir procurar. Esta tela inverte: entra pela
// pessoa, filtra por etapa e vaga, e cai no pipeline certo.
//
// Comparacao de nota so acontece dentro da mesma etapa (decisao travada no
// modelo de pontuacao), por isso o fit exibido e o `stage_score`.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, ArrowUpRight, Bot } from 'lucide-react';
import { PageShell, EmptyState } from '@/components/page-shell';
import { BrandCtaLink } from '@/components/brand-cta';
import { Input } from '@/components/ui/input';
import { useAllApplications, STAGES, type CandidateRow } from '@/hooks/use-all-applications';
import { cn } from '@/lib/utils';

export function Candidates() {
  const { rows, loading, countsByStage, jobs } = useAllApplications();
  const [stage, setStage] = useState<string>('todos');
  const [jobId, setJobId] = useState<string>('todas');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (stage !== 'todos' && row.status !== stage) return false;
      if (jobId !== 'todas' && row.job_id !== jobId) return false;
      if (!q) return true;
      return (
        row.candidate_name.toLowerCase().includes(q) ||
        row.candidate_email.toLowerCase().includes(q) ||
        row.job_title.toLowerCase().includes(q)
      );
    });
  }, [rows, stage, jobId, query]);

  const openCount = rows.filter(
    (r) => r.status !== 'contratado' && r.status !== 'reprovado',
  ).length;

  return (
    <PageShell
      width="wide"
      eyebrow="Candidatos"
      title={
        rows.length > 0
          ? `${rows.length} ${rows.length === 1 ? 'candidatura' : 'candidaturas'}`
          : 'Candidatos'
      }
      description={
        rows.length > 0
          ? `${openCount} em processo aberto. Filtre por etapa ou vaga e abra o pipeline pra decidir.`
          : 'Todo mundo que se candidatou, em qualquer vaga, num lugar só.'
      }
    >
      {loading ? (
        <CandidateSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" strokeWidth={1.75} />}
          title="Nenhuma candidatura ainda"
          description="Assim que alguém se candidatar por uma career page, a pessoa aparece aqui já com a análise da etapa pronta."
          action={<BrandCtaLink to="/app/jobs">Ver minhas vagas</BrandCtaLink>}
          hint="A career page de cada vaga ativa é pública e gerada automaticamente."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, email ou vaga"
                aria-label="Buscar candidatos"
                className="h-12 rounded-card pl-11 text-callout"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label="Todas as etapas"
                count={rows.length}
                active={stage === 'todos'}
                onClick={() => setStage('todos')}
              />
              {STAGES.map((s) => (
                <FilterChip
                  key={s.value}
                  label={s.label}
                  count={countsByStage[s.value] ?? 0}
                  active={stage === s.value}
                  onClick={() => setStage(s.value)}
                />
              ))}
            </div>

            {jobs.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption font-semibold text-ink-subtle">Vaga:</span>
                <FilterChip
                  label="Todas"
                  active={jobId === 'todas'}
                  onClick={() => setJobId('todas')}
                />
                {jobs.map((job) => (
                  <FilterChip
                    key={job.id}
                    label={job.title}
                    active={jobId === job.id}
                    onClick={() => setJobId(job.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="surface-card px-6 py-12 text-center">
              <p className="text-callout text-ink-muted">
                Nenhum candidato com esses filtros.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStage('todos');
                  setJobId('todas');
                  setQuery('');
                }}
                className="mt-3 text-footnote font-semibold text-brand transition-colors hover:text-brand-hover"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {filtered.map((row) => (
                <li key={row.id}>
                  <CandidateRowCard row={row} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-footnote font-semibold',
        'transition-colors duration-200 ease-standard',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line-soft bg-surface text-ink-muted hover:border-line hover:text-ink',
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn('tabular-nums', active ? 'text-white/60' : 'text-ink-subtle')}>
          {count}
        </span>
      )}
    </button>
  );
}

function CandidateRowCard({ row }: { row: CandidateRow }) {
  const pending = !row.analysis_status || row.analysis_status === 'pending';
  const initial = row.candidate_name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Link
      to={`/app/jobs/${row.job_id}`}
      className="surface-card-interactive group flex items-center gap-4 px-4 py-4 sm:px-5"
    >
      <span className="icon-tile h-11 w-11 shrink-0 font-satoshi text-callout font-bold">
        {initial}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-satoshi text-title-3 font-bold text-ink">
            {row.candidate_name}
          </span>
          {row.ai_suspected && (
            <span
              title="Respostas com indício de geração por IA"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-tint px-2 py-0.5 text-eyebrow font-bold uppercase text-warning"
            >
              <Bot className="h-3 w-3" strokeWidth={2.5} />
              IA
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-footnote text-ink-subtle">
          {row.job_title}
        </span>
      </span>

      <StageBadge stage={row.status} />

      <span className="hidden w-16 shrink-0 text-right sm:block">
        {pending ? (
          <span className="text-caption text-ink-subtle">analisando</span>
        ) : row.stage_score !== null ? (
          <>
            <span className="block font-satoshi text-title-2 font-bold tabular-nums text-ink">
              {row.stage_score}
            </span>
            <span className="block text-eyebrow font-bold uppercase text-ink-subtle">Fit</span>
          </>
        ) : (
          <span className="text-caption text-ink-subtle">—</span>
        )}
      </span>

      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
        aria-hidden
      />
    </Link>
  );
}

const STAGE_TONE: Record<string, string> = {
  triagem: 'bg-canvas text-ink-muted',
  entrevista: 'bg-brand-tint text-brand',
  proposta: 'bg-warning-tint text-warning',
  contratado: 'bg-positive-tint text-positive',
  reprovado: 'bg-canvas text-ink-subtle',
};

function StageBadge({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.value === stage)?.label ?? stage;
  return (
    <span
      className={cn(
        'hidden shrink-0 rounded-full px-2.5 py-1 text-eyebrow font-bold uppercase sm:inline-flex',
        STAGE_TONE[stage] ?? 'bg-canvas text-ink-muted',
      )}
    >
      {label}
    </span>
  );
}

/** Reserva o espaco da lista pra evitar salto de layout quando os dados chegam. */
function CandidateSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Carregando candidatos">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="surface-card flex items-center gap-4 px-5 py-4">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-tile bg-canvas" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded-full bg-canvas" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-canvas" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Candidates;
