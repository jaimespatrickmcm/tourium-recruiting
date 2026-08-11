import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Building2, Briefcase, Sparkles } from 'lucide-react';
import { BrandCtaLink } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { supabase } from '@/lib/supabase';

export function Dashboard() {
  const { company, loading } = useCompany();
  const [jobsCount, setJobsCount] = useState(0);

  useEffect(() => {
    if (!company) return;
    void supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .then(({ count }) => setJobsCount(count ?? 0));
  }, [company]);

  if (loading) {
    return <div className="p-8 text-[#8a8a8f] text-sm">Carregando...</div>;
  }

  const empresaCompleted = !!company?.company_completed_at && !!company?.description?.trim();
  const culture = (company?.dna_document?.culture as string | undefined) ?? '';
  const dnaCompleted = !!company?.dna_completed_at && culture.trim().length >= 80;
  const readyForJobs = empresaCompleted && dnaCompleted;

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-4xl mx-auto px-8 py-12">
        <div className="mb-10">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
            Dashboard
          </p>
          <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
            Bem-vindo{company ? `, ${company.name}` : ''}
          </h1>
          <p className="text-[16px] text-[#6b6b70] mt-3 max-w-xl leading-relaxed">
            {!empresaCompleted
              ? 'Comece configurando a empresa.'
              : !dnaCompleted
              ? 'Empresa pronta. Configure o DNA pra IA analisar candidatos sob seu contexto.'
              : jobsCount === 0
              ? 'Tudo pronto. Crie sua primeira vaga.'
              : `${jobsCount} ${jobsCount === 1 ? 'vaga ativa' : 'vagas ativas'}. A IA analisa cada candidatura.`}
          </p>
        </div>

        <div className="space-y-5">
          <StatusCard
            icon={<Building2 className="h-5 w-5 text-white" strokeWidth={2.5} />}
            title="Empresa"
            description="Nome, descrição do que vocês fazem e site. Identidade básica."
            status={empresaCompleted ? 'completed' : 'pending'}
            statusLabel={empresaCompleted ? 'Cadastro completo' : 'Cadastro incompleto'}
            href="/app/empresa"
            cta={empresaCompleted ? 'Ver empresa' : 'Configurar empresa'}
          />
          <StatusCard
            icon={<Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />}
            title="DNA da empresa"
            description="Cultura, ritmo, quem performa bem aí. A IA lê esse texto e usa em cada análise."
            status={dnaCompleted ? 'completed' : 'pending'}
            statusLabel={dnaCompleted ? 'DNA configurado' : 'DNA pendente'}
            href="/app/dna"
            cta={dnaCompleted ? 'Ver DNA' : 'Configurar DNA'}
            disabled={!empresaCompleted}
          />
          <StatusCard
            icon={<Briefcase className="h-5 w-5 text-white" strokeWidth={2.5} />}
            title="Vagas"
            description={
              jobsCount === 0
                ? 'Crie a primeira vaga. Career page pública gerada automaticamente.'
                : `${jobsCount} ${jobsCount === 1 ? 'vaga' : 'vagas'}. Cada candidatura é analisada pela IA.`
            }
            status={jobsCount > 0 ? 'completed' : 'pending'}
            statusLabel={jobsCount > 0 ? `${jobsCount} ${jobsCount === 1 ? 'vaga' : 'vagas'}` : ''}
            href="/app/jobs"
            cta={jobsCount > 0 ? 'Ver vagas' : 'Criar primeira vaga'}
            disabled={!readyForJobs}
          />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  status,
  statusLabel,
  href,
  cta,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: 'completed' | 'pending';
  statusLabel: string;
  href: string;
  cta: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={
        'bg-white rounded-[28px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-8 ' +
        (disabled ? 'opacity-50' : '')
      }
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl holo-gradient flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <h2 className="font-satoshi font-bold text-[22px] tracking-[-0.3px] text-[#1d1d1f]">
            {title}
          </h2>
        </div>
        {statusLabel && (
          <span
            className={
              'inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1 border ' +
              (status === 'completed'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                : 'text-amber-700 bg-amber-50 border-amber-100')
            }
          >
            {status === 'completed' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            {statusLabel}
          </span>
        )}
      </div>
      <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-6 max-w-xl">{description}</p>
      {disabled ? (
        <p className="text-[12px] font-medium text-[#8a8a8f]">Complete o passo anterior primeiro.</p>
      ) : (
        <BrandCtaLink to={href}>{cta}</BrandCtaLink>
      )}
    </div>
  );
}
