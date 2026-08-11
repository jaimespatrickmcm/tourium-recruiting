import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft, CheckCircle2, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { supabase } from '@/lib/supabase';

const TOTAL_STEPS = 2;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function JobNewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { company } = useCompany();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setDescription('');
      setGenerationError(null);
      setGenerating(false);
      hasGeneratedRef.current = false;
    }
  }, [open]);

  const dirty = title.length > 0 || description.length > 0;

  function handleClose() {
    if (dirty && !saving) {
      const ok = window.confirm('Você tem alterações não salvas. Fechar e perder?');
      if (!ok) return;
    }
    onClose();
  }

  async function generateDescription() {
    if (!title.trim() || generating) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-description', {
        body: { jobTitle: title.trim() },
      });
      if (error) throw error;
      if (!data?.ok || !data.description) {
        throw new Error(data?.error ?? 'IA não retornou descrição');
      }
      setDescription(data.description);
      hasGeneratedRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar descrição';
      setGenerationError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function goToStep2() {
    setStep(2);
    // Auto-trigger generation on first entry only
    if (!hasGeneratedRef.current && !description) {
      await generateDescription();
    }
  }

  async function save() {
    if (!company) return;
    setSaving(true);

    const baseSlug = slugify(title) || 'vaga';
    let finalSlug = baseSlug;
    let attempt = 0;
    while (attempt < 50) {
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', company.id)
        .eq('slug', finalSlug)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      finalSlug = `${baseSlug}-${attempt}`;
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        company_id: company.id,
        slug: finalSlug,
        title,
        description: description || null,
      })
      .select('id')
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? 'Erro ao criar vaga');
      return;
    }
    toast.success('Vaga criada.');
    onClose();
    navigate(`/app/jobs/${data.id}`);
  }

  const step1Valid = title.trim().length >= 3;
  const step2Valid = description.trim().length >= 30 && !generating;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className="max-w-2xl p-0 rounded-[24px] border-gray-200 shadow-[0_30px_80px_-20px_rgba(15,15,30,0.25)] overflow-hidden gap-0 [&>button]:hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          firstInputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Nova vaga</DialogTitle>
        <DialogDescription className="sr-only">
          Crie uma vaga em {TOTAL_STEPS} passos.
        </DialogDescription>

        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
              Nova vaga
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
        <div className="px-8 py-7">
          {step === 1 && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                Qual o título da vaga?
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Direto, do jeito que apareceria num LinkedIn. A IA usa esse título + a cultura da
                empresa pra gerar a descrição no próximo passo.
              </p>
              <Input
                ref={firstInputRef}
                placeholder="Senior Backend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && step1Valid) {
                    e.preventDefault();
                    void goToStep2();
                  }
                }}
                className="h-12 rounded-xl border-gray-200 text-[16px]"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f]">
                  Descrição gerada pela IA
                </h2>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={generating || !title.trim()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mt-2"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Gerar de novo
                </button>
              </div>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Ajuste o que quiser. A IA usa essa descrição + a cultura da empresa pra analisar
                cada candidato.
              </p>

              {generating && !description ? (
                <div className="min-h-[260px] rounded-xl border border-gray-200 bg-gray-50/40 p-5 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-[#6b6b70]">
                    <div className="relative">
                      <Sparkles className="h-5 w-5 text-sky-500" />
                      <div className="absolute inset-0 animate-ping">
                        <Sparkles className="h-5 w-5 text-sky-400 opacity-40" />
                      </div>
                    </div>
                    <p className="text-[14px]">Gerando descrição com base na sua cultura...</p>
                  </div>
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="Descrição da vaga..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={12}
                    className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none font-mono"
                  />
                  <p
                    className={
                      'text-[11px] mt-1.5 ' +
                      (description.length >= 30 ? 'text-emerald-600' : 'text-[#8a8a8f]')
                    }
                  >
                    {description.length} chars · mínimo 30
                  </p>
                </>
              )}

              {generationError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-800">
                  {generationError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1 || saving}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {step === 1 ? (
            <BrandCtaButton size="sm" onClick={goToStep2} disabled={!step1Valid}>
              <Sparkles className="h-4 w-4 mr-1" />
              Gerar com IA
            </BrandCtaButton>
          ) : (
            <BrandCtaButton size="sm" onClick={save} disabled={!step2Valid || saving}>
              {saving ? 'Criando...' : 'Criar vaga'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JobNewModal;
