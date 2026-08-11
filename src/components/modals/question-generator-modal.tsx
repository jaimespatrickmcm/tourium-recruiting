import { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import type { QuestionKind } from '@/types/database';

export type GeneratorMode =
  | { kind: 'culture' }
  | { kind: 'reasoning' }
  | { kind: 'job'; jobId: string };

type DraftQuestion = {
  question: string;
  guidance: string;
  scoring_rubric: string;
};

type Props = {
  open: boolean;
  mode: GeneratorMode;
  companyId: string;
  /** Pula a geração e abre direto na revisão com uma pergunta em branco. */
  startManual?: boolean;
  onClose: () => void;
  onDone: () => void;
};

const KIND_COPY: Record<GeneratorMode['kind'], { label: string; intro: string; placeholder: string }> = {
  culture: {
    label: 'Perguntas de cultura',
    intro:
      'A IA vai propor perguntas abertas que medem ética de trabalho e fit com a cultura da sua empresa. Todo candidato responde as mesmas.',
    placeholder:
      "Ex: 'O que mais importa pra gente é ownership. Quem espera prioridade cair de cima não engrena. Async first, decisão pelos times.'",
  },
  reasoning: {
    label: 'Perguntas de raciocínio',
    intro:
      'A IA vai propor perguntas de raciocínio lógico, padronizadas e comparáveis entre candidatos. Se quiser, deixe uma nota do que priorizar.',
    placeholder: "Ex: 'Foco em priorização e clareza de pensamento, nada de quebra-cabeça decorado.'",
  },
  job: {
    label: 'Perguntas da vaga',
    intro:
      'A IA vai propor perguntas técnicas específicas dessa vaga, com base no título, na descrição e na cultura da empresa.',
    placeholder: '',
  },
};

function emptyQuestion(): DraftQuestion {
  return { question: '', guidance: '', scoring_rubric: '' };
}

export function QuestionGeneratorModal({
  open,
  mode,
  companyId,
  startManual = false,
  onClose,
  onDone,
}: Props) {
  const [step, setStep] = useState(1);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const copy = KIND_COPY[mode.kind];

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    setNotes('');
    setGenerating(false);
    setGenerationError(null);
    setSaving(false);
    if (startManual) {
      setQuestions([emptyQuestion()]);
      setStep(3);
    } else {
      setQuestions([]);
      setStep(1);
    }
  }, [open, startManual]);

  function handleClose() {
    if ((questions.length > 0 || notes.length > 0) && step === 3 && !saving) {
      const ok = window.confirm('Você tem perguntas não salvas. Fechar e perder?');
      if (!ok) return;
    }
    onClose();
  }

  async function generate() {
    setGenerating(true);
    setGenerationError(null);
    setStep(2);
    try {
      const fnName = mode.kind === 'job' ? 'generate-job-questions' : 'generate-questions';
      const body =
        mode.kind === 'job'
          ? { jobId: mode.jobId }
          : { kind: mode.kind, notes: notes.trim() || undefined };

      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.questions)) {
        throw new Error(data?.error ?? 'IA não retornou perguntas');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drafts: DraftQuestion[] = (data.questions as any[]).map((q) => ({
        question: String(q?.question ?? ''),
        guidance: String(q?.guidance ?? ''),
        scoring_rubric: String(q?.scoring_rubric ?? ''),
      }));
      setQuestions(drafts.length > 0 ? drafts : [emptyQuestion()]);
      setStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar perguntas';
      setGenerationError(message);
      setStep(1);
    } finally {
      setGenerating(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addManual() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  async function save() {
    const valid = questions.filter((q) => q.question.trim().length > 0);
    if (valid.length === 0) {
      toast.error('Escreva pelo menos uma pergunta.');
      return;
    }
    setSaving(true);

    try {
      // Append: posição inicial = maior posição existente + 1.
      let basePosition = 0;
      if (mode.kind === 'job') {
        const { data: existing } = await supabase
          .from('job_questions')
          .select('position')
          .eq('job_id', mode.jobId)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle();
        basePosition = (existing?.position ?? -1) + 1;

        const rows = valid.map((q, i) => ({
          job_id: mode.jobId,
          company_id: companyId,
          position: basePosition + i,
          question: q.question.trim(),
          guidance: q.guidance.trim() || null,
          scoring_rubric: q.scoring_rubric.trim() || null,
        }));
        const { error } = await supabase.from('job_questions').insert(rows);
        if (error) throw error;
      } else {
        const kind = mode.kind as QuestionKind;
        const { data: existing } = await supabase
          .from('company_questions')
          .select('position')
          .eq('kind', kind)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle();
        basePosition = (existing?.position ?? -1) + 1;

        const rows = valid.map((q, i) => ({
          company_id: companyId,
          kind,
          position: basePosition + i,
          question: q.question.trim(),
          guidance: q.guidance.trim() || null,
          scoring_rubric: q.scoring_rubric.trim() || null,
        }));
        const { error } = await supabase.from('company_questions').insert(rows);
        if (error) throw error;
      }

      toast.success(valid.length === 1 ? 'Pergunta salva.' : `${valid.length} perguntas salvas.`);
      onDone();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-2xl p-0 rounded-[24px] border-gray-200 shadow-[0_30px_80px_-20px_rgba(15,15,30,0.25)] overflow-hidden gap-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{copy.label}</DialogTitle>
        <DialogDescription className="sr-only">
          Gere e revise perguntas padrão em até {totalSteps} passos.
        </DialogDescription>

        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
              {copy.label}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[12px] font-medium text-[#6b6b70]">
                Passo <span className="text-[#1d1d1f] font-bold">{step}</span> de {totalSteps}
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
            aria-valuemax={totalSteps}
          >
            <div
              className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-7 max-h-[62vh] overflow-y-auto">
          {step === 1 && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                Gerar {copy.label.toLowerCase()}
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">{copy.intro}</p>

              {mode.kind !== 'job' && (
                <>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-2">
                    Notas pra IA (opcional)
                  </label>
                  <Textarea
                    placeholder={copy.placeholder}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
                  />
                  <p className="text-[11px] mt-1.5 text-[#8a8a8f]">
                    Deixe em branco pra usar só a cultura já cadastrada no DNA.
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

          {step === 2 && (
            <div className="min-h-[300px] flex items-center justify-center">
              <div className="flex items-center gap-3 text-[#6b6b70]">
                <div className="relative">
                  <Sparkles className="h-5 w-5 text-sky-500" />
                  <div className="absolute inset-0 animate-ping">
                    <Sparkles className="h-5 w-5 text-sky-400 opacity-40" />
                  </div>
                </div>
                <p className="text-[14px]">Gerando perguntas com base na sua empresa...</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f]">
                  Revisar perguntas
                </h2>
                {!startManual && (
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-40 shrink-0 mt-2"
                  >
                    {generating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Gerar de novo
                  </button>
                )}
              </div>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                Edite o texto, a resposta esperada e a régua de pontuação. Apague o que não quiser.
                Só salva ao aprovar.
              </p>

              <div className="space-y-3">
                {questions.map((q, i) => (
                  <DraftQuestionRow
                    key={i}
                    index={i}
                    draft={q}
                    onChange={(patch) => updateQuestion(i, patch)}
                    onRemove={() => removeQuestion(i)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addManual}
                className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-sky-700 hover:text-sky-900 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar manual
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={() => {
              if (step === 3 && !startManual) setStep(1);
            }}
            disabled={step !== 3 || startManual || saving}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {step === 1 && (
            <BrandCtaButton size="sm" onClick={generate} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-1" />
              Gerar com IA
            </BrandCtaButton>
          )}
          {step === 3 && (
            <BrandCtaButton size="sm" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar perguntas'}
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </BrandCtaButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftQuestionRow({
  index,
  draft,
  onChange,
  onRemove,
}: {
  index: number;
  draft: DraftQuestion;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-6 min-w-6 px-2 items-center justify-center rounded-full bg-sky-600 text-white text-[11px] font-bold shrink-0 mt-1">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <Textarea
            value={draft.question}
            onChange={(e) => onChange({ question: e.target.value })}
            rows={2}
            placeholder="O que o candidato lê..."
            className="rounded-lg border-gray-200 bg-white text-[14px] leading-relaxed resize-none"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-[#8a8a8f] hover:bg-white hover:text-[#1d1d1f] transition-colors"
            aria-label={expanded ? 'Recolher critérios' : 'Ver critérios internos'}
            aria-expanded={expanded}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-7 w-7 rounded-full flex items-center justify-center text-[#8a8a8f] hover:bg-red-50 hover:text-red-600 transition-colors"
            aria-label="Remover pergunta"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-200/70 pt-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-1.5">
              Resposta esperada (interno)
            </label>
            <Textarea
              value={draft.guidance}
              onChange={(e) => onChange({ guidance: e.target.value })}
              rows={2}
              placeholder="O que uma boa resposta demonstra..."
              className="rounded-lg border-gray-200 bg-white text-[13px] leading-relaxed resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-1.5">
              Como pontuar (interno)
            </label>
            <Textarea
              value={draft.scoring_rubric}
              onChange={(e) => onChange({ scoring_rubric: e.target.value })}
              rows={2}
              placeholder="Como dar nota de 0 a 100..."
              className="rounded-lg border-gray-200 bg-white text-[13px] leading-relaxed resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionGeneratorModal;
