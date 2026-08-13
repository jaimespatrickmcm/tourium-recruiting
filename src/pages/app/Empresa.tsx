import {
  Building2,
  Globe,
  CheckCircle2,
  AlertCircle,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { BrandCtaButton } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { useModal } from '@/contexts/modal-context';

export function Empresa() {
  const { company, loading } = useCompany();
  const { openModal } = useModal();

  if (loading) {
    return <div className="p-8 text-ink-subtle text-sm">Carregando...</div>;
  }
  if (!company) {
    return <div className="p-8 text-ink-muted">Empresa não encontrada.</div>;
  }

  const empresaCompleted = !!company.company_completed_at;
  const hasDescription = !!company.description?.trim();
  const hasWebsite = !!company.website_url?.trim();

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-caption font-bold uppercase tracking-wider text-ink-subtle mb-3">
              Empresa
            </p>
            <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-ink">
              {company.name}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              {empresaCompleted && hasDescription ? (
                <span className="inline-flex items-center gap-1.5 text-eyebrow font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Cadastro completo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-eyebrow font-bold uppercase text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                  <AlertCircle className="h-3 w-3" />
                  Cadastro incompleto
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openModal('empresa')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-line-soft bg-white text-footnote font-semibold text-ink hover:border-line transition-colors whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </div>

        {/* Content */}
        {!hasDescription ? (
          <EmptyEmpresa onCadastrar={() => openModal('empresa')} />
        ) : (
          <div className="bg-white rounded-panel border border-line-soft shadow-e2 p-8 space-y-6">
            {hasWebsite && (
              <InfoBlock label="Site" icon={Globe}>
                <a
                  href={company.website_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-callout text-sky-600 hover:underline"
                >
                  {company.website_url}
                </a>
              </InfoBlock>
            )}
            <InfoBlock label="O que vocês fazem" icon={Building2}>
              <p className="text-callout text-ink leading-relaxed whitespace-pre-wrap">
                {company.description}
              </p>
            </InfoBlock>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyEmpresa({ onCadastrar }: { onCadastrar: () => void }) {
  return (
    <div className="bg-white rounded-panel border border-line-soft shadow-e2 p-12 text-center">
      <div className="inline-flex h-14 w-14 rounded-card holo-gradient items-center justify-center mb-5">
        <Building2 className="h-7 w-7 text-white" strokeWidth={2} />
      </div>
      <h2 className="font-satoshi font-bold text-[22px] tracking-[-0.3px] text-ink mb-2">
        Complete o cadastro da empresa
      </h2>
      <p className="text-callout text-ink-muted leading-relaxed mb-6 max-w-md mx-auto">
        Adiciona descrição do que vocês fazem e o site. A IA usa esse contexto pra avaliar cada
        candidato.
      </p>
      <BrandCtaButton onClick={onCadastrar}>Cadastrar empresa</BrandCtaButton>
    </div>
  );
}

function InfoBlock({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={2} />
        <p className="text-eyebrow font-bold uppercase text-ink-subtle">{label}</p>
      </div>
      {children}
    </div>
  );
}

export default Empresa;
