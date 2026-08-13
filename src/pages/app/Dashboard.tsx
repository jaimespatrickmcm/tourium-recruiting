// Inicio da area logada.
//
// Antes: uma lista de 3 passos de setup e mais nada. Depois do onboarding
// concluido a tela virava decoracao — o usuario chegava nela todo dia pra ver
// tres cards verdes. Agora ela tem dois modos: checklist enquanto o setup nao
// fechou, painel de operacao depois.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Building2, Briefcase, Sparkles, Users, ArrowUpRight } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { BrandCtaLink } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Counts = { jobs: number; applications: number; pendingReview: number };

export function Dashboard() {
  const { company, loading } = useCompany();
  const [counts, setCounts] = useState<Counts>({ jobs: 0, applications: 0, pendingReview: 0 });

  useEffect(() => {
    if (!company) return;
    async function load() {
      const [jobs, applications, triagem] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('*', { count: 'exact', head: true }),
        supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'triagem'),
      ]);
      setCounts({
        jobs: jobs.count ?? 0,
        applications: applications.count ?? 0,
        pendingReview: triagem.count ?? 0,
      });
    }
    void load();
  }, [company]);

  const empresaCompleted = !!company?.company_completed_at && !!company?.description?.trim();
  const culture = (company?.dna_document?.culture as string | undefined) ?? '';
  const dnaCompleted = !!company?.dna_completed_at && culture.trim().length >= 80;
  const setupDone = empresaCompleted && dnaCompleted && counts.jobs > 0;

  if (loading) {
    return (
      <PageShell eyebrow="Início" title="Carregando">
        <div className="surface-card h-40 animate-pulse" />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Início"
      title={company ? `Olá, ${company.name}` : 'Olá'}
      description={
        setupDone
          ? counts.pendingReview > 0
            ? `${counts.pendingReview} ${counts.pendingReview === 1 ? 'candidato aguardando' : 'candidatos aguardando'} sua triagem.`
            : 'Nada esperando por você agora. Tudo em dia.'
          : 'Faltam alguns passos pra análise ler os candidatos com o contexto da sua empresa.'
      }
      action={
        setupDone ? <BrandCtaLink to="/app/candidatos">Ver candidatos</BrandCtaLink> : undefined
      }
    >
      {setupDone ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            to="/app/jobs"
            icon={<Briefcase className="h-4 w-4" strokeWidth={2} />}
            value={counts.jobs}
            label={counts.jobs === 1 ? 'vaga' : 'vagas'}
          />
          <MetricCard
            to="/app/candidatos"
            icon={<Users className="h-4 w-4" strokeWidth={2} />}
            value={counts.applications}
            label={counts.applications === 1 ? 'candidatura' : 'candidaturas'}
          />
          <MetricCard
            to="/app/candidatos"
            icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}
            value={counts.pendingReview}
            label="em triagem"
            emphasis={counts.pendingReview > 0}
          />
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          <SetupStep
            index={1}
            icon={<Building2 className="h-4 w-4" strokeWidth={2} />}
            title="Empresa"
            description="Nome, o que vocês fazem e site. É a identidade que o candidato vê."
            done={empresaCompleted}
            href="/app/empresa"
            cta={empresaCompleted ? 'Revisar' : 'Configurar empresa'}
          />
          <SetupStep
            index={2}
            icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}
            title="DNA da empresa"
            description="Cultura, ritmo e quem performa bem aí. É esse texto que a análise usa como régua."
            done={dnaCompleted}
            href="/app/dna"
            cta={dnaCompleted ? 'Revisar' : 'Configurar DNA'}
            blocked={!empresaCompleted}
          />
          <SetupStep
            index={3}
            icon={<Briefcase className="h-4 w-4" strokeWidth={2} />}
            title="Primeira vaga"
            description="A career page pública sai pronta junto com a vaga."
            done={counts.jobs > 0}
            href="/app/jobs"
            cta={counts.jobs > 0 ? 'Ver vagas' : 'Criar primeira vaga'}
            blocked={!empresaCompleted || !dnaCompleted}
          />
        </ol>
      )}
    </PageShell>
  );
}

function MetricCard({
  to,
  icon,
  value,
  label,
  emphasis,
}: {
  to: string;
  icon: React.ReactNode;
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link to={to} className="surface-card-interactive group p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className={cn('icon-tile h-9 w-9', emphasis && 'bg-warning-tint text-warning')}>
          {icon}
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-ink-subtle transition-colors group-hover:text-ink"
          aria-hidden
        />
      </div>
      <p className="font-satoshi text-display font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-footnote text-ink-muted">{label}</p>
    </Link>
  );
}

function SetupStep({
  index,
  icon,
  title,
  description,
  done,
  href,
  cta,
  blocked,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
  blocked?: boolean;
}) {
  return (
    <li
      className={cn(
        'surface-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between',
        blocked && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn('icon-tile h-10 w-10 shrink-0', done && 'bg-positive-tint text-positive')}
          aria-hidden
        >
          {done ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} /> : icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-eyebrow font-bold uppercase text-ink-subtle">Passo {index}</span>
            {done && (
              <span className="rounded-full bg-positive-tint px-2 py-0.5 text-eyebrow font-bold uppercase text-positive">
                Pronto
              </span>
            )}
          </div>
          <h2 className="mt-1 font-satoshi text-title-3 font-bold text-ink">{title}</h2>
          <p className="mt-1 max-w-md text-footnote text-ink-muted">{description}</p>
        </div>
      </div>

      {blocked ? (
        <p className="shrink-0 text-caption text-ink-subtle sm:text-right">
          Complete o passo anterior
        </p>
      ) : (
        <BrandCtaLink
          to={href}
          size="sm"
          variant={done ? 'secondary' : 'primary'}
          showArrow={!done}
          className="shrink-0"
        >
          {cta}
        </BrandCtaLink>
      )}
    </li>
  );
}

export default Dashboard;
