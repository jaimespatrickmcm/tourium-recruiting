import { CheckCircle2, AlertCircle, Pencil, Sparkles } from 'lucide-react';
import { BrandCtaButton } from '@/components/brand-cta';
import { DnaSymbol } from '@/components/dna-symbol';
import { useCompany } from '@/hooks/use-company';
import { useModal } from '@/contexts/modal-context';

export function Dna() {
  const { company, loading } = useCompany();
  const { openModal } = useModal();

  if (loading) {
    return <div className="p-8 text-[#8a8a8f] text-sm">Carregando...</div>;
  }
  if (!company) {
    return <div className="p-8 text-[#6b6b70]">Empresa não encontrada.</div>;
  }

  const culture = (company.dna_document?.culture as string | undefined) ?? '';
  const dnaCompleted = !!company.dna_completed_at && culture.trim().length >= 80;

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.07),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
              DNA da empresa
            </p>
            <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
              {company.name}
            </h1>
            <div className="mt-3 flex items-center gap-2">
              {dnaCompleted ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                  <CheckCircle2 className="h-3 w-3" />
                  DNA configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                  <AlertCircle className="h-3 w-3" />
                  DNA pendente
                </span>
              )}
            </div>
          </div>
          {dnaCompleted && (
            <button
              type="button"
              onClick={() => openModal('dna')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-[#1d1d1f] hover:border-gray-400 transition-colors whitespace-nowrap"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
        </div>

        {!dnaCompleted ? (
          <EmptyDna onConfigurar={() => openModal('dna')} />
        ) : (
          <FilledDna culture={culture} />
        )}
      </div>
    </div>
  );
}

function EmptyDna({ onConfigurar }: { onConfigurar: () => void }) {
  return (
    <div className="bg-white rounded-[28px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-12 text-center">
      <div className="flex justify-center mb-6">
        <DnaSymbol size={140} />
      </div>

      <h2 className="font-satoshi font-bold text-[24px] tracking-[-0.4px] text-[#1d1d1f] mb-3 max-w-md mx-auto">
        Configure o DNA da sua empresa
      </h2>
      <p className="text-[15px] text-[#6b6b70] leading-relaxed mb-8 max-w-md mx-auto">
        O DNA é o texto que a IA usa pra entender como sua empresa pensa, decide e trabalha. Sem
        ele, a análise de candidato vira genérica. Com ele, vira contextual.
      </p>

      <BrandCtaButton onClick={onConfigurar}>
        <Sparkles className="h-4 w-4" strokeWidth={2.5} />
        Configurar DNA
      </BrandCtaButton>
    </div>
  );
}

function FilledDna({ culture }: { culture: string }) {
  return (
    <div className="space-y-6">
      {/* DNA symbol + tagline */}
      <div className="bg-white rounded-[28px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-8 flex items-center gap-6">
        <div className="flex-shrink-0">
          <DnaSymbol size={100} />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-sky-50 border border-sky-200">
            <Sparkles className="h-3 w-3 text-sky-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              Contexto IA ativo
            </span>
          </div>
          <p className="text-[15px] text-[#6b6b70] leading-relaxed">
            Esse texto vai pra IA junto com cada candidato. A análise referencia esses elementos pra
            calcular fit contextual.
          </p>
        </div>
      </div>

      {/* Culture content */}
      <div className="bg-white rounded-[28px] border border-gray-200 shadow-[0_10px_40px_-15px_rgba(15,15,30,0.08)] p-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-4">
          Como vocês trabalham
        </p>
        <p className="text-[15px] text-[#1d1d1f] leading-[1.7] whitespace-pre-wrap">{culture}</p>
      </div>
    </div>
  );
}

export default Dna;
