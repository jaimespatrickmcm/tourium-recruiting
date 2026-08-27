import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase, ExternalLink, ArrowUpRight } from 'lucide-react';
import { PageShell, EmptyState } from '@/components/page-shell';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';
import { useModal } from '@/contexts/modal-context';
import { cn } from '@/lib/utils';
import { compareJobs, jobStatusLabel, jobStatusRank, jobStatusTone } from '@/lib/job-status';

type Job = {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
  applications_count?: number;
};

export function Jobs() {
  const { company } = useCompany();
  const { openModal } = useModal();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, slug, title, status, created_at, applications(count)')
        .order('created_at', { ascending: false });

      if (jobsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const withCounts = (jobsData as any[]).map((j) => ({
          ...j,
          applications_count: j.applications?.[0]?.count ?? 0,
        })) as Job[];
        // Ativa primeiro. Ordenar so por data fazia uma vaga encerrada em
        // setembro aparecer acima de uma ativa aberta em agosto, e a lista
        // existe pra trabalhar nas ativas.
        withCounts.sort(compareJobs);
        setJobs(withCounts);
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <PageShell
      width="wide"
      eyebrow="Vagas"
      title={jobs.length > 0 ? `${jobs.length} ${jobs.length === 1 ? 'vaga' : 'vagas'}` : 'Vagas'}
      description="Cada vaga vira uma career page pública. A análise lê cada candidatura sob o DNA da sua empresa."
      action={
        <BrandCtaButton onClick={() => openModal('job-new')} showArrow={false}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Nova vaga
        </BrandCtaButton>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Carregando vagas">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface-card h-[88px] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-7 w-7" strokeWidth={1.75} />}
          title="Nenhuma vaga ainda"
          description="Crie a primeira vaga e a career page pública é gerada junto, pronta pra divulgar."
          action={<BrandCtaButton onClick={() => openModal('job-new')}>Criar vaga</BrandCtaButton>}
          hint="Descrição, requisitos e perguntas podem ser geradas a partir do DNA."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {jobs.map((job, i) => {
            // Separador na virada de ativa pra nao-ativa. Sem ele a lista muda
            // de significado no meio sem avisar, e o unico aviso seria a cor da
            // etiqueta, que e pequena demais pra carregar isso sozinha.
            const prev = i > 0 ? jobs[i - 1] : null;
            const startsInactive =
              jobStatusRank(job.status) > 0 &&
              prev !== null &&
              jobStatusRank(prev.status) === 0;
            return (
            <li key={job.id}>
              {startsInactive && (
                <p className="mb-2 mt-5 px-1 text-eyebrow font-bold uppercase text-ink-subtle">
                  Fora do ar
                </p>
              )}
              <div className="surface-card-interactive group relative flex items-center gap-4 px-4 py-4 sm:px-5">
                <Link
                  to={`/app/jobs/${job.id}`}
                  className="min-w-0 flex-1 after:absolute after:inset-0"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="truncate font-satoshi text-title-3 font-bold text-ink">
                      {job.title}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-eyebrow font-bold uppercase',
                        jobStatusTone(job.status),
                      )}
                    >
                      {jobStatusLabel(job.status)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-footnote text-ink-subtle">
                    {job.applications_count ?? 0} candidato
                    {job.applications_count === 1 ? '' : 's'}
                  </span>
                </Link>

                {company && job.status === 'active' && (
                  <a
                    href={`/careers/${company.slug}/${job.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    // z-10 pra escapar do overlay do link do card acima.
                    className="relative z-10 hidden shrink-0 items-center gap-1.5 rounded-full border border-line-soft px-3 py-1.5 text-caption font-semibold text-ink-muted transition-colors hover:border-line hover:text-ink sm:inline-flex"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Career page
                  </a>
                )}

                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
                  aria-hidden
                />
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

export default Jobs;
