import { useEffect, useRef, useState } from 'react';
import { Globe, Loader2, X, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { supabase } from '@/lib/supabase';

type Draft = {
  name: string;
  websiteUrl: string;
  description: string;
};

const TOTAL_STEPS = 2;

export function EmpresaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { company, update } = useCompany();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({ name: '', websiteUrl: '', description: '' });
  const [initial, setInitial] = useState<Draft>({ name: '', websiteUrl: '', description: '' });
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (!company || initializedRef.current) return;
    initializedRef.current = true;
    const next: Draft = {
      name: company.name ?? '',
      websiteUrl: company.website_url ?? '',
      description: company.description ?? '',
    };
    setDraft(next);
    setInitial(next);
    setStep(1);
  }, [open, company]);

  const dirty =
    draft.name !== initial.name ||
    draft.websiteUrl !== initial.websiteUrl ||
    draft.description !== initial.description;

  function handleClose() {
    if (dirty && !saving) {
      const ok = window.confirm('Você tem alterações não salvas. Fechar e perder?');
      if (!ok) return;
    }
    onClose();
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function scrapeUrl() {
    if (!draft.websiteUrl.trim()) return;
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-company', {
        body: { url: draft.websiteUrl.trim() },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.message(data?.error ?? 'Não consegui ler o site. Preenche manualmente.');
        return;
      }
      const sc = data.scraped ?? {};
      const foundName = sc.name?.trim();
      const foundDesc = sc.description?.trim();
      if (!foundName && !foundDesc) {
        toast.message('Site sem meta tags. Preenche manualmente.');
        // Ainda atualiza a URL normalizada
        setDraft((d) => ({ ...d, websiteUrl: data.url }));
        return;
      }
      setDraft((d) => ({
        ...d,
        websiteUrl: data.url,
        name: foundName ?? d.name,
        description: foundDesc ?? d.description,
      }));
      const parts: string[] = [];
      if (foundName) parts.push(`nome: ${foundName}`);
      if (foundDesc) parts.push('descrição');
      toast.success(`Achei ${parts.join(' + ')}. Confere e ajusta.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar URL');
    } finally {
      setScraping(false);
    }
  }

  async function saveAndAdvance(nextStep: number, finalize = false) {
    setSaving(true);
    const patch: Record<string, unknown> = {
      name: draft.name,
      website_url: draft.websiteUrl || null,
      description: draft.description || null,
    };
    if (finalize) patch.company_completed_at = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await update(patch as any);
    setSaving(false);
    if (error) {
      toast.error(`Erro: ${error}`);
      return false;
    }
    setInitial(draft);
    if (finalize) {
      toast.success('Empresa salva.');
      onClose();
      return true;
    }
    setStep(nextStep);
    return true;
  }

  const step1Valid = draft.name.trim().length >= 2;
  const step2Valid = draft.description.trim().length >= 20;

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
        <DialogTitle className="sr-only">Cadastrar empresa</DialogTitle>
        <DialogDescription className="sr-only">
          Configure as informações da sua empresa em {TOTAL_STEPS} passos.
        </DialogDescription>

        {/* Header */}
        <div className="shrink-0 px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
              Empresa
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
                Identidade da empresa
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Cola a URL do site e a gente preenche o que dá. Você confirma.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">
                    Site (opcional)
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8a8f]" />
                      <Input
                        ref={firstInputRef}
                        placeholder="acme.com"
                        value={draft.websiteUrl}
                        onChange={(e) => set('websiteUrl', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void scrapeUrl();
                          }
                        }}
                        disabled={scraping}
                        className="h-11 pl-10 rounded-xl border-gray-200 text-[15px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={scrapeUrl}
                      disabled={scraping || !draft.websiteUrl.trim()}
                      className="h-11 px-4 rounded-xl bg-[#1d1d1f] text-white font-semibold text-[13px] hover:bg-[#1d1d1f]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      {scraping ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Lendo
                        </>
                      ) : (
                        'Buscar'
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-1.5">
                    Nome da empresa <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Acme Inc"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={
                      'h-11 rounded-xl text-[15px] ' +
                      (draft.name.trim().length > 0 && draft.name.trim().length < 2
                        ? 'border-red-300 focus-visible:ring-red-200'
                        : 'border-gray-200')
                    }
                  />
                  {draft.name.trim().length > 0 && draft.name.trim().length < 2 && (
                    <p className="text-[11px] text-red-600 mt-1">Mínimo 2 caracteres.</p>
                  )}
                  {draft.name.trim().length === 0 && (
                    <p className="text-[11px] text-[#8a8a8f] mt-1">
                      Obrigatório pra continuar. Cola o site acima e clica "Buscar" pra preencher
                      automático, ou digita manualmente.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                O que vocês fazem?
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Em 2-3 frases. Esse texto vai pra IA como parte do contexto da empresa.
              </p>
              <Textarea
                placeholder="Ex: SaaS de gestão financeira pra startups BR. Automatizamos conciliação bancária e fluxo de caixa. 22 pessoas, crescendo 12% MoM, foco em ARR."
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                rows={6}
                className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
              />
              <p
                className={
                  'text-[11px] mt-1.5 ' +
                  (draft.description.length >= 20 ? 'text-emerald-600' : 'text-[#8a8a8f]')
                }
              >
                {draft.description.length} chars · mínimo 20
              </p>
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

          {step === 1 && (
            <BrandCtaButton size="sm" onClick={() => saveAndAdvance(2)} disabled={!step1Valid || saving}>
              {saving ? 'Salvando...' : 'Continuar'}
            </BrandCtaButton>
          )}
          {step === 2 && (
            <BrandCtaButton size="sm" onClick={() => saveAndAdvance(step, true)} disabled={!step2Valid || saving}>
              {saving ? 'Salvando...' : 'Salvar empresa'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EmpresaModal;
