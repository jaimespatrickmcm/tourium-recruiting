import { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Wand2,
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

/**
 * Alvo da geração:
 * - `company`: perguntas de cultura E raciocínio (kind 'mixed' no backend).
 * - `job`: perguntas técnicas de uma vaga.
 */
export type GeneratorMode =
  | { type: 'company' }
  | { type: 'job'; jobId: string };

/** Método de criação escolhido no primeiro passo. `null` = manual. */
type GenMethod = 'noren' | 'scratch' | 'job' | null;

type Phase = 'method' | 'notes' | 'generating' | 'review';

type DraftQuestion = {
  question: string;
  guidance: string;
  scoring_rubric: string;
  /** Só usado quando o alvo é `company`. */
  kind: QuestionKind;
};

type Props = {
  open: boolean;
  mode: GeneratorMode;
  companyId: string;
  /** Pula a escolha de método e abre direto na revisão com uma pergunta em branco. */
  startManual?: boolean;
  onClose: () => void;
  onDone: () => void;
};

function normalizeKind(value: unknown): QuestionKind {
  return value === 'reasoning' ? 'reasoning' : 'culture';
}

function emptyQuestion(): DraftQuestion {
  return { question: '', guidance: '', scoring_rubric: '', kind: 'culture' };
}

function KindChip({ kind }: { kind: QuestionKind }) {
  const label = kind === 'culture' ? 'Cultura' : 'Raciocínio';
  const cls =
    kind === 'culture'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : 'bg-violet-50 text-violet-700 border-violet-200';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

export function QuestionGeneratorModal({
  open,
  mode,
  companyId,
  startManual = false,
  onClose,
  onDone,
}: Props) {
  const [phase, setPhase] = useState<Phase>('method');
  const [notes, setNotes] = useState('');
  const [genMethod, setGenMethod] = useState<GenMethod>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const isJob = mode.type === 'job';
  const headerLabel = isJob ? 'Perguntas da vaga' : 'Cultura e raciocínio';

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
      setGenMethod(null);
      setQuestions([emptyQuestion()]);
      setPhase('review');
    } else {
      setGenMethod(null);
      setQuestions([]);
      setPhase('method');
    }
  }, [open, startManual]);

  function handleClose() {
    if (questions.length > 0 && phase === 'review' && !saving) {
      const ok = window.confirm('Você tem perguntas não salvas. Fechar e perder?');
      if (!ok) return;
    }
    onClose();
  }

  async function runGenerate(method: Exclude<GenMethod, null>) {
    setGenMethod(method);
    setGenerating(true);
    setGenerationError(null);
    setPhase('generating');
    try {
      let data: { ok?: boolean; questions?: unknown; error?: string } | null = null;
      let error: unknown = null;

      if (mode.type === 'job') {
        const res = await supabase.functions.invoke('generate-job-questions', {
          body: { jobId: mode.jobId },
        });
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase.functions.invoke('generate-questions', {
          body: {
            kind: 'mixed',
            mode: method === 'noren' ? 'noren' : 'scratch',
            notes: notes.trim() || undefined,
          },
        });
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      if (!data?.ok || !Array.isArray(data.questions)) {
        throw new Error(data?.error ?? 'IA não retornou perguntas');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drafts: DraftQuestion[] = (data.questions as any[]).map((q) => ({
        question: String(q?.question ?? ''),
        guidance: String(q?.guidance ?? ''),
        scoring_rubric: String(q?.scoring_rubric ?? ''),
        kind: normalizeKind(q?.kind),
      }));
      setQuestions(drafts.length > 0 ? drafts : [emptyQuestion()]);
      setPhase('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar perguntas';
      setGenerationError(message);
      setPhase('method');
    } finally {
      setGenerating(false);
    }
  }

  function startManualFlow() {
    setGenMethod(null);
    setGenerationError(null);
    setQuestions([emptyQuestion()]);
    setPhase('review');
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
      if (mode.type === 'job') {
        // A lista revisada aqui é o conjunto final da vaga. Substitui em vez de
        // empilhar: apaga as antigas antes de inserir, senão regenerar acumula.
        // Respostas já enviadas guardam question_snapshot e não referenciam
        // job_questions por FK, então não quebram.
        const { error: delError } = await supabase
          .from('job_questions')
          .delete()
          .eq('job_id', mode.jobId);
        if (delError) throw delError;

        const rows = valid.map((q, i) => ({
          job_id: mode.jobId,
          company_id: companyId,
          position: i,
          question: q.question.trim(),
          guidance: q.guidance.trim() || null,
          scoring_rubric: q.scoring_rubric.trim() || null,
        }));
        const { error } = await supabase.from('job_questions').insert(rows);
        if (error) throw error;
      } else {
        // Mixed: cada pergunta guarda seu próprio kind e uma posição
        // incremental POR kind (culture e reasoning têm sequências separadas).
        const { data: existing } = await supabase
          .from('company_questions')
          .select('kind, position');
        const nextByKind: Record<QuestionKind, number> = { culture: 0, reasoning: 0 };
        for (const row of (existing as { kind: QuestionKind; position: number }[] | null) ?? []) {
          if (row.position + 1 > nextByKind[row.kind]) {
            nextByKind[row.kind] = row.position + 1;
          }
        }

        const rows = valid.map((q) => {
          const kind = q.kind;
          const position = nextByKind[kind];
          nextByKind[kind] = position + 1;
          return {
            company_id: companyId,
            kind,
            position,
            question: q.question.trim(),
            guidance: q.guidance.trim() || null,
            scoring_rubric: q.scoring_rubric.trim() || null,
          };
        });
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
  const stepNum = phase === 'method' ? 1 : phase === 'review' ? 3 : 2;
  const cameFromAi = genMethod !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-2xl p-0 rounded-[24px] border-gray-200 shadow-[0_30px_80px_-20px_rgba(15,15,30,0.25)] overflow-hidden gap-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{headerLabel}</DialogTitle>
        <DialogDescription className="sr-only">
          Escolha um método, gere e revise perguntas padrão em até {totalSteps} passos.
        </DialogDescription>

        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f]">
              {headerLabel}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[12px] font-medium text-[#6b6b70]">
                Passo <span className="text-[#1d1d1f] font-bold">{stepNum}</span> de {totalSteps}
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
            aria-valuenow={stepNum}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            <div
              className="h-full holo-gradient rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(stepNum / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-7 max-h-[62vh] overflow-y-auto">
          {phase === 'method' && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                {isJob ? 'Como criar as perguntas da vaga?' : 'Como criar suas perguntas?'}
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                {isJob
                  ? 'Perguntas técnicas específicas dessa vaga. Todo candidato da vaga responde as mesmas.'
                  : 'Perguntas de cultura e raciocínio da empresa. Todo candidato responde as mesmas.'}
              </p>

              <div className="space-y-3">
                {!isJob && (
                  <MethodCard
                    icon={<Wand2 className="h-5 w-5" />}
                    title="Método Noren"
                    description="Usa as perguntas padrão da Noren, já adaptadas ao DNA da sua empresa. Rápido e testado."
                    onClick={() => void runGenerate('noren')}
                  />
                )}
                <MethodCard
                  icon={<Sparkles className="h-5 w-5" />}
                  title={isJob ? 'Gerar com IA (calibrado à vaga)' : 'Gerar do zero com IA'}
                  description={
                    isJob
                      ? 'A IA cria perguntas técnicas a partir do título, da descrição e da cultura da empresa.'
                      : 'A IA cria perguntas novas a partir do DNA da empresa. Você pode deixar uma nota do que priorizar.'
                  }
                  onClick={() => {
                    if (isJob) {
                      void runGenerate('job');
                    } else {
                      setGenMethod('scratch');
                      setPhase('notes');
                    }
                  }}
                />
                <MethodCard
                  icon={<Plus className="h-5 w-5" />}
                  title="Adicionar manual"
                  description={
                    isJob
                      ? 'Escreva as perguntas técnicas na mão, uma por uma.'
                      : 'Escreva suas próprias perguntas na mão, uma por uma.'
                  }
                  onClick={startManualFlow}
                />
              </div>

              {generationError && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-800">
                  {generationError}
                </div>
              )}
            </div>
          )}

          {phase === 'notes' && (
            <div>
              <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f] mb-2">
                Gerar do zero com IA
              </h2>
              <p className="text-[14px] text-[#6b6b70] leading-relaxed mb-6">
                A IA vai propor perguntas de cultura e raciocínio a partir do DNA da empresa. Se
                quiser, deixe uma nota do que priorizar.
              </p>

              <label className="block text-[12px] font-semibold text-[#1d1d1f] mb-2">
                Notas pra IA (opcional)
              </label>
              <Textarea
                placeholder="Ex: 'O que mais importa pra gente é ownership. Foco em priorização e clareza de pensamento.'"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="rounded-xl border-gray-200 text-[15px] leading-relaxed resize-none"
              />
              <p className="text-[11px] mt-1.5 text-[#8a8a8f]">
                Deixe em branco pra usar só a cultura já cadastrada no DNA.
              </p>

              {generationError && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-800">
                  {generationError}
                </div>
              )}
            </div>
          )}

          {phase === 'generating' && (
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

          {phase === 'review' && (
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="font-satoshi font-bold text-[22px] md:text-[26px] tracking-[-0.4px] leading-tight text-[#1d1d1f]">
                  Revisar perguntas
                </h2>
                {cameFromAi && (
                  <button
                    type="button"
                    onClick={() => void runGenerate(genMethod as Exclude<GenMethod, null>)}
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
                    showKind={!isJob}
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
              if (phase === 'notes') {
                setPhase('method');
              } else if (phase === 'review' && !startManual) {
                setPhase('method');
              }
            }}
            disabled={
              saving ||
              phase === 'generating' ||
              phase === 'method' ||
              (phase === 'review' && startManual)
            }
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {phase === 'notes' && (
            <BrandCtaButton size="sm" onClick={() => void runGenerate('scratch')} disabled={generating}>
              <Sparkles className="h-4 w-4 mr-1" />
              Gerar com IA
            </BrandCtaButton>
          )}
          {phase === 'review' && (
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

function MethodCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-gray-200 bg-white p-4 flex items-start gap-4 hover:border-sky-300 hover:bg-sky-50/30 transition-colors"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-100 transition-colors">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-satoshi font-bold text-[16px] tracking-[-0.2px] text-[#1d1d1f]">
          {title}
        </span>
        <span className="block text-[13px] text-[#6b6b70] leading-relaxed mt-0.5">
          {description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#c4c4c9] group-hover:text-sky-500 transition-colors shrink-0 mt-1" />
    </button>
  );
}

function DraftQuestionRow({
  index,
  draft,
  showKind,
  onChange,
  onRemove,
}: {
  index: number;
  draft: DraftQuestion;
  showKind: boolean;
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
          {showKind && (
            <div className="flex items-center gap-1.5 mb-2">
              <KindToggle
                value={draft.kind}
                onChange={(kind) => onChange({ kind })}
              />
            </div>
          )}
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

function KindToggle({
  value,
  onChange,
}: {
  value: QuestionKind;
  onChange: (kind: QuestionKind) => void;
}) {
  const options: { key: QuestionKind; label: string }[] = [
    { key: 'culture', label: 'Cultura' },
    { key: 'reasoning', label: 'Raciocínio' },
  ];
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5">
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
              active ? 'bg-sky-600 text-white' : 'text-[#8a8a8f] hover:text-[#1d1d1f]'
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export { KindChip };

export default QuestionGeneratorModal;
