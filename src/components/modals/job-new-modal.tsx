import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowLeft, CheckCircle2, Sparkles, RefreshCw, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { useCompany } from '@/hooks/use-company';
import { supabase } from '@/lib/supabase';
import type { HighlightType } from '@/types/database';

const TOTAL_STEPS = 3;

type JobQuestionDraft = {
  question: string;
  guidance: string;
  scoring_rubric: string;
  required: boolean;
};

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
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [highlightOn, setHighlightOn] = useState(false);
  const [highlightType, setHighlightType] = useState<HighlightType>('yes_no');
  const [highlightQuestion, setHighlightQuestion] = useState('');
  const [highlightExpected, setHighlightExpected] = useState<'sim' | 'nao'>('sim');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Passo 3: perguntas da vaga
  const [newJobId, setNewJobId] = useState<string | null>(null);
  const [qDrafts, setQDrafts] = useState<JobQuestionDraft[]>([]);
  const [qGenerating, setQGenerating] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [qSaving, setQSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setDescription('');
      setVisibility('private');
      setHighlightOn(false);
      setHighlightType('yes_no');
      setHighlightQuestion('');
      setHighlightExpected('sim');
      setGenerationError(null);
      setGenerating(false);
      setNewJobId(null);
      setQDrafts([]);
      setQGenerating(false);
      setQError(null);
      setQSaving(false);
      hasGeneratedRef.current = false;
    }
  }, [open]);

  const dirty = title.length > 0 || description.length > 0;

  function handleClose() {
    // No passo 3 a vaga já foi criada. Fechar leva pra ela (as perguntas são opcionais).
    if (step === 3) {
      onClose();
      if (newJobId) navigate(`/app/jobs/${newJobId}`);
      return;
    }
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

  async function createJob() {
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
        visibility,
        highlight_question: highlightOn && highlightQuestion.trim() ? highlightQuestion.trim() : null,
        highlight_type: highlightOn && highlightQuestion.trim() ? highlightType : null,
        highlight_expected:
          highlightOn && highlightType === 'yes_no' && highlightQuestion.trim()
            ? highlightExpected
            : null,
      })
      .select('id')
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? 'Erro ao criar vaga');
      return;
    }
    // Vaga criada. Segue pro passo 3 e já dispara a geração das perguntas dela.
    setNewJobId(data.id);
    setStep(3);
    void generateJobQuestions(data.id);
  }

  async function generateJobQuestions(jobId: string) {
    setQGenerating(true);
    setQError(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-questions', {
        body: { jobId },
      });
      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.questions)) {
        throw new Error(data?.error ?? 'IA não retornou perguntas');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQDrafts(
        (data.questions as any[]).map((q) => ({
          question: String(q?.question ?? ''),
          guidance: String(q?.guidance ?? ''),
          scoring_rubric: String(q?.scoring_rubric ?? ''),
          required: (q as any)?.required === true,
        })),
      );
    } catch (err) {
      setQError(err instanceof Error ? err.message : 'Erro ao gerar perguntas');
    } finally {
      setQGenerating(false);
    }
  }

  function updateDraft(index: number, question: string) {
    setQDrafts((prev) => prev.map((q, i) => (i === index ? { ...q, question } : q)));
  }

  function toggleDraftRequired(index: number) {
    setQDrafts((prev) =>
      prev.map((q, i) => (i === index ? { ...q, required: !q.required } : q)),
    );
  }

  function removeDraft(index: number) {
    setQDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function addDraft() {
    setQDrafts((prev) => [
      ...prev,
      { question: '', guidance: '', scoring_rubric: '', required: false },
    ]);
  }

  function goToJob() {
    onClose();
    if (newJobId) navigate(`/app/jobs/${newJobId}`);
  }

  async function finishWithQuestions() {
    if (!company || !newJobId) return;
    const valid = qDrafts.filter((q) => q.question.trim().length > 0);
    setQSaving(true);
    try {
      if (valid.length > 0) {
        const rows = valid.map((q, i) => ({
          job_id: newJobId,
          company_id: company.id,
          position: i,
          question: q.question.trim(),
          guidance: q.guidance.trim() || null,
          scoring_rubric: q.scoring_rubric.trim() || null,
          required: q.required,
        }));
        const { error } = await supabase.from('job_questions').insert(rows);
        if (error) throw error;
      }
      toast.success(
        valid.length > 0 ? 'Vaga criada com as perguntas.' : 'Vaga criada.',
      );
      goToJob();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perguntas');
      setQSaving(false);
    }
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

              {/* Visibilidade da vaga */}
              <div className="mt-5">
                <p className="text-[12px] font-semibold text-[#1d1d1f] mb-2">Onde essa vaga aparece</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={
                      'text-left rounded-xl border px-3.5 py-3 transition-colors ' +
                      (visibility === 'private'
                        ? 'border-sky-500 bg-sky-50/60'
                        : 'border-gray-200 hover:border-gray-300')
                    }
                  >
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Privada</p>
                    <p className="text-[12px] text-[#6b6b70] mt-0.5">
                      Só quem tem o link da vaga consegue se candidatar.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={
                      'text-left rounded-xl border px-3.5 py-3 transition-colors ' +
                      (visibility === 'public'
                        ? 'border-sky-500 bg-sky-50/60'
                        : 'border-gray-200 hover:border-gray-300')
                    }
                  >
                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Pública</p>
                    <p className="text-[12px] text-[#6b6b70] mt-0.5">
                      Entra no portal de vagas e chega a candidatos que procuram.
                    </p>
                  </button>
                </div>
              </div>

              {/* Pergunta de destaque (opcional) */}
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <button
                  type="button"
                  onClick={() => setHighlightOn((v) => !v)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={
                      'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ' +
                      (highlightOn ? 'border-sky-500 bg-sky-500' : 'border-gray-300 bg-white')
                    }
                  >
                    {highlightOn && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-[#1d1d1f]">
                      Adicionar pergunta de destaque
                    </span>
                    <span className="block text-[12px] text-[#6b6b70] mt-0.5">
                      Uma pergunta rápida de triagem que todo candidato responde antes de enviar.
                    </span>
                  </span>
                </button>

                {highlightOn && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHighlightType('yes_no')}
                        className={
                          'rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition-colors ' +
                          (highlightType === 'yes_no'
                            ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                            : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                        }
                      >
                        Sim ou Não
                      </button>
                      <button
                        type="button"
                        onClick={() => setHighlightType('short_text')}
                        className={
                          'rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold transition-colors ' +
                          (highlightType === 'short_text'
                            ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                            : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                        }
                      >
                        Texto curto
                      </button>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
                        A pergunta
                      </label>
                      <Input
                        value={highlightQuestion}
                        onChange={(e) => setHighlightQuestion(e.target.value)}
                        placeholder="Tem disponibilidade para trabalho presencial em BH?"
                        className="h-11 rounded-xl border-gray-200 text-[15px]"
                      />
                    </div>

                    {highlightType === 'yes_no' && (
                      <div>
                        <label className="mb-1.5 block text-[12px] font-semibold text-[#1d1d1f]">
                          Resposta ideal
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setHighlightExpected('sim')}
                            className={
                              'rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors ' +
                              (highlightExpected === 'sim'
                                ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                                : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                            }
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={() => setHighlightExpected('nao')}
                            className={
                              'rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors ' +
                              (highlightExpected === 'nao'
                                ? 'border-sky-500 bg-sky-50/60 text-[#1d1d1f]'
                                : 'border-gray-200 text-[#6b6b70] hover:border-gray-300')
                            }
                          >
                            Não
                          </button>
                        </div>
                        <p className="mt-1.5 text-[12px] text-[#8a8a8f]">
                          Candidatos com outra resposta ficam sinalizados, não reprovados.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f]">
                  Perguntas da vaga
                </h2>
                <button
                  type="button"
                  onClick={() => newJobId && void generateJobQuestions(newJobId)}
                  disabled={qGenerating}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mt-2"
                >
                  {qGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Gerar de novo
                </button>
              </div>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Perguntas técnicas específicas desta vaga, calibradas ao nível dela. Todo candidato
                responde as mesmas, junto com as de cultura da empresa. Edite ou remova o que quiser.
              </p>

              {qGenerating && qDrafts.length === 0 ? (
                <div className="min-h-[220px] rounded-xl border border-gray-200 bg-gray-50/40 p-5 flex items-center justify-center">
                  <div className="flex items-center gap-3 text-[#6b6b70]">
                    <div className="relative">
                      <Sparkles className="h-5 w-5 text-sky-500" />
                      <div className="absolute inset-0 animate-ping">
                        <Sparkles className="h-5 w-5 text-sky-400 opacity-40" />
                      </div>
                    </div>
                    <p className="text-[14px]">Gerando perguntas com base na vaga...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {qDrafts.map((q, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 flex items-start gap-3"
                    >
                      <span className="inline-flex h-6 min-w-6 px-2 items-center justify-center rounded-full bg-sky-600 text-white text-[11px] font-bold shrink-0 mt-1">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => toggleDraftRequired(i)}
                            aria-pressed={q.required}
                            className={
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ' +
                              (q.required
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-gray-200 bg-white text-[#8a8a8f] hover:text-[#1d1d1f]')
                            }
                          >
                            Obrigatória
                          </button>
                        </div>
                        <Textarea
                          value={q.question}
                          onChange={(e) => updateDraft(i, e.target.value)}
                          rows={2}
                          placeholder="O que o candidato lê..."
                          className="rounded-lg border-gray-200 bg-white text-[14px] leading-relaxed resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDraft(i)}
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[#8a8a8f] hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 mt-1"
                        aria-label="Remover pergunta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addDraft}
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-sky-700 hover:text-sky-900 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar manual
                  </button>
                </div>
              )}

              {qError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-800">
                  {qError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          {step === 3 ? (
            <button
              onClick={goToJob}
              disabled={qSaving}
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
            >
              Pular por enquanto
            </button>
          ) : (
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1 || saving}
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          )}

          {step === 1 && (
            <BrandCtaButton size="sm" onClick={goToStep2} disabled={!step1Valid}>
              <Sparkles className="h-4 w-4 mr-1" />
              Gerar com IA
            </BrandCtaButton>
          )}
          {step === 2 && (
            <BrandCtaButton size="sm" onClick={createJob} disabled={!step2Valid || saving}>
              {saving ? 'Criando...' : 'Criar vaga'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
          {step === 3 && (
            <BrandCtaButton size="sm" onClick={finishWithQuestions} disabled={qSaving || qGenerating}>
              {qSaving ? 'Salvando...' : 'Concluir'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default JobNewModal;
