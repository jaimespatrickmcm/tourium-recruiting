import { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';

const TOTAL_STEPS = 2;

export function DnaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { company, update } = useCompany();
  const [step, setStep] = useState(1);
  const [culture, setCulture] = useState('');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (!company || initializedRef.current) return;
    initializedRef.current = true;
    const next = (company.dna_document?.culture as string | undefined) ?? '';
    setCulture(next);
    setInitial(next);
    setStep(1);
  }, [open, company]);

  const dirty = culture !== initial;

  function handleClose() {
    if (dirty && !saving) {
      const ok = window.confirm('Você tem alterações não salvas. Fechar e perder?');
      if (!ok) return;
    }
    onClose();
  }

  async function save(finalize = false) {
    setSaving(true);
    const dna = { ...(company?.dna_document ?? {}), culture };
    const patch: Record<string, unknown> = { dna_document: dna };
    if (finalize) {
      patch.dna_completed_at = culture.trim().length >= 80 ? new Date().toISOString() : null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await update(patch as any);
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error}`);
      return;
    }
    setInitial(culture);
    if (finalize) {
      toast.success('DNA configurado.');
      onClose();
    } else {
      setStep(step + 1);
    }
  }

  const validCulture = culture.trim().length >= 80;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="max-w-2xl p-0 rounded-[24px] border-gray-200 shadow-[0_30px_80px_-20px_rgba(15,15,30,0.25)] overflow-hidden gap-0 flex flex-col [&>button]:hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstInputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Configurar DNA</DialogTitle>
        <DialogDescription className="sr-only">
          Configure o DNA cultural da empresa em {TOTAL_STEPS} passos.
        </DialogDescription>

        {/* Header */}
        <div className="shrink-0 px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
              DNA da empresa
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[12px] font-medium text-[#6b6b70]">
                Passo <span className="text-[#1d1d1f] font-bold">{step}</span> de {TOTAL_STEPS}
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="h-8 w-8 rounded-full flex items-center justify-center text-[#6b6b70] hover:bg-gray-100 hover:text-[#1d1d1f] transition-colors"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            className="h-1 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
          >
            <div
              className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-7">
          {step === 1 && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                Como vocês trabalham?
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Texto livre, específico. A IA vai LER tudo isso e usar pra avaliar cada candidato.
                Conta cultura, ritmo, autonomia, quem performa bem e quem não engrena.
              </p>
              <Textarea
                ref={firstInputRef}
                placeholder="Ex: 'Async first, decisões pelos times sem aprovar tudo. Quem performa bem assume problema sem esperar prioridade vir de cima. Reclamamos pouco, fazemos muito. Pessoas que precisam de tudo escrito e aprovado pra agir não engrenam aqui.'"
                value={culture}
                onChange={(e) => setCulture(e.target.value)}
                rows={11}
                className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
              />
              <p
                className={
                  'text-[11px] mt-1.5 ' + (validCulture ? 'text-emerald-600' : 'text-[#8a8a8f]')
                }
              >
                {culture.length} chars · mínimo 80
              </p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                Revisar DNA
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Esse texto vai pra IA junto com cada candidato. Pode editar depois reabrindo o
                modal.
              </p>
              <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5">
                <p className="text-[14px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                  {culture}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1 || saving}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {step === 1 ? (
            <BrandCtaButton size="sm" onClick={() => save(false)} disabled={!validCulture || saving}>
              {saving ? 'Salvando...' : 'Continuar'}
            </BrandCtaButton>
          ) : (
            <BrandCtaButton size="sm" onClick={() => save(true)} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar DNA'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DnaModal;
