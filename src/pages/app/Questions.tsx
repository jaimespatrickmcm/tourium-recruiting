import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ListChecks,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BrandCtaButton } from '@/components/brand-cta';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';
import {
  useCompanyQuestions,
  useJobQuestions,
  updateCompanyQuestion,
  deleteCompanyQuestion,
  updateJobQuestion,
  deleteJobQuestion,
  type CompanyQuestion,
  type JobQuestion,
  type QuestionPatch,
} from '@/hooks/use-questions';
import {
  QuestionGeneratorModal,
  KindChip,
  type GeneratorMode,
} from '@/components/modals/question-generator-modal';
import type { QuestionFormat, QuestionKind } from '@/types/database';

type JobLite = { id: string; title: string };

type EditableQuestion = {
  id: string;
  question: string;
  guidance: string | null;
  scoring_rubric: string | null;
  required: boolean;
  format: QuestionFormat;
  options: string[] | null;
};

const FORMAT_LABEL: Record<QuestionFormat, string | null> = {
  text: null, // formato padrão, não precisa de chip
  number: 'Número',
  single_select: 'Escolha única',
  multi_select: 'Múltipla escolha',
};

function isSelectFormat(format: QuestionFormat): boolean {
  return format === 'single_select' || format === 'multi_select';
}

const KIND_ORDER: QuestionKind[] = ['profile', 'culture', 'curiosity', 'reasoning'];

const KIND_EMPTY_LABEL: Record<QuestionKind, string> = {
  profile: 'sobre o candidato',
  culture: 'cultura',
  curiosity: 'curiosidade',
  reasoning: 'raciocínio',
};

type ModalState = { mode: GeneratorMode; startManual: boolean } | null;

export function Questions() {
  const { company } = useCompany();
  const {
    questions: companyQuestions,
    loading: loadingCompany,
    refetch: refetchCompany,
  } = useCompanyQuestions();
  const { questions: jobQuestions, refetch: refetchJobs } = useJobQuestions();
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from('jobs')
        .select('id, title')
        .order('created_at', { ascending: false });
      setJobs((data as JobLite[] | null) ?? []);
    }
    void loadJobs();
  }, []);

  const questionsByKind = useMemo(
    () =>
      Object.fromEntries(
        KIND_ORDER.map((kind) => [kind, companyQuestions.filter((q) => q.kind === kind)]),
      ) as Record<QuestionKind, CompanyQuestion[]>,
    [companyQuestions],
  );

  function openGenerator(mode: GeneratorMode, startManual = false) {
    setModal({ mode, startManual });
  }

  function onGeneratorDone() {
    void refetchCompany();
    void refetchJobs();
  }

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.06),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-caption font-bold uppercase tracking-wider text-ink-subtle mb-3">
            Perguntas
          </p>
          <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-ink">
            Banco de perguntas
          </h1>
          <p className="text-body text-ink-muted mt-3 max-w-xl leading-relaxed">
            Essas perguntas entram no formulário de candidatura. Todo candidato responde as mesmas,
            então a comparação fica justa. A IA gera com base no DNA da sua empresa e usa a resposta
            esperada pra pontuar cada candidato.
          </p>
        </div>

        <Tabs defaultValue="company">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Da empresa</TabsTrigger>
            <TabsTrigger value="job">Por vaga</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <UnifiedCompanyPanel
              questionsByKind={questionsByKind}
              loading={loadingCompany}
              onGerar={() => openGenerator({ type: 'company' })}
              onManual={() => openGenerator({ type: 'company' }, true)}
              onChanged={refetchCompany}
            />
          </TabsContent>

          <TabsContent value="job">
            <JobPanel
              jobs={jobs}
              jobQuestions={jobQuestions}
              onGerar={(jobId) => openGenerator({ type: 'job', jobId })}
              onManual={(jobId) => openGenerator({ type: 'job', jobId }, true)}
              onChanged={refetchJobs}
            />
          </TabsContent>
        </Tabs>
      </div>

      {modal && company && (
        <QuestionGeneratorModal
          open
          mode={modal.mode}
          companyId={company.id}
          startManual={modal.startManual}
          onClose={() => setModal(null)}
          onDone={onGeneratorDone}
        />
      )}
    </div>
  );
}

function UnifiedCompanyPanel({
  questionsByKind,
  loading,
  onGerar,
  onManual,
  onChanged,
}: {
  questionsByKind: Record<QuestionKind, CompanyQuestion[]>;
  loading: boolean;
  onGerar: () => void;
  onManual: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const total = KIND_ORDER.reduce((sum, kind) => sum + questionsByKind[kind].length, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <p className="text-callout text-ink-muted leading-relaxed max-w-md">
          Perguntas sobre o candidato (história e triagem), cultura (fit com o DNA), curiosidade e
          raciocínio lógico. Geradas juntas e padronizadas pra todo candidato.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onManual}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-line-soft bg-white text-footnote font-semibold text-ink hover:border-line transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar manual
          </button>
          <BrandCtaButton size="sm" onClick={onGerar}>
            <Sparkles className="h-4 w-4 mr-1" />
            Gerar perguntas
          </BrandCtaButton>
        </div>
      </div>

      {loading ? (
        <div className="text-ink-subtle text-sm">Carregando...</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-panel border border-line-soft p-10 text-center">
          <div className="inline-flex h-14 w-14 rounded-card bg-surface-sunken items-center justify-center mb-4">
            <ListChecks className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />
          </div>
          <p className="text-[18px] font-semibold text-ink mb-2">
            Nenhuma pergunta de cultura ou raciocínio ainda
          </p>
          <p className="text-callout text-ink-muted mb-6 max-w-md mx-auto leading-relaxed">
            Use o método Noren, gere do zero com IA ou escreva na mão. Elas ficam padronizadas pra
            todo candidato.
          </p>
          <BrandCtaButton onClick={onGerar}>
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Gerar perguntas
          </BrandCtaButton>
        </div>
      ) : (
        <div className="space-y-8">
          {KIND_ORDER.map((kind) => (
            <KindGroup
              key={kind}
              kind={kind}
              questions={questionsByKind[kind]}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KindGroup({
  kind,
  questions,
  onChanged,
}: {
  kind: QuestionKind;
  questions: CompanyQuestion[];
  onChanged: () => void | Promise<void>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <KindChip kind={kind} />
        <span className="text-footnote text-ink-subtle font-medium">
          {questions.length} pergunta{questions.length === 1 ? '' : 's'}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-footnote text-[#a8a8ad] italic">
          Nenhuma pergunta de {KIND_EMPTY_LABEL[kind]} ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              index={i}
              data={q}
              onSave={async (patch) => {
                const { error } = await updateCompanyQuestion(q.id, patch);
                if (error) {
                  toast.error(error.message);
                  return false;
                }
                await onChanged();
                return true;
              }}
              onDelete={async () => {
                const { error } = await deleteCompanyQuestion(q.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success('Pergunta removida.');
                await onChanged();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobPanel({
  jobs,
  jobQuestions,
  onGerar,
  onManual,
  onChanged,
}: {
  jobs: JobLite[];
  jobQuestions: JobQuestion[];
  onGerar: (jobId: string) => void;
  onManual: (jobId: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-panel border border-line-soft p-10 text-center">
        <div className="inline-flex h-14 w-14 rounded-card bg-surface-sunken items-center justify-center mb-4">
          <Briefcase className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />
        </div>
        <p className="text-[18px] font-semibold text-ink mb-2">Nenhuma vaga ainda</p>
        <p className="text-callout text-ink-muted max-w-md mx-auto leading-relaxed">
          Crie uma vaga primeiro. Cada vaga ganha perguntas técnicas específicas, além das
          perguntas de cultura e raciocínio da empresa.
        </p>
      </div>
    );
  }

  // Uma vaga por vez: com todas abertas a tela vira um rolo interminável.
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? jobs[0];
  const qs = jobQuestions.filter((q) => q.job_id === selectedJob.id);

  return (
    <div className="space-y-4">
      <p className="text-callout text-ink-muted leading-relaxed max-w-xl">
        Perguntas técnicas específicas de cada vaga. Entram no formulário junto com as perguntas de
        cultura e raciocínio da empresa.
      </p>

      <div>
        <label
          htmlFor="job-select"
          className="block text-caption font-semibold text-ink mb-1.5"
        >
          Vaga
        </label>
        <div className="relative max-w-sm">
          <select
            id="job-select"
            value={selectedJob.id}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full appearance-none rounded-tile border border-line-soft bg-white py-2.5 pl-3.5 pr-10 text-callout font-medium text-ink outline-none transition-colors hover:border-line focus:border-brand"
          >
            {jobs.map((job) => {
              const count = jobQuestions.filter((q) => q.job_id === job.id).length;
              return (
                <option key={job.id} value={job.id}>
                  {job.title} ({count})
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        </div>
      </div>

      {(() => {
        const job = selectedJob;
        return (
          <div key={job.id} className="bg-white rounded-card border border-line-soft p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <p className="font-satoshi font-bold text-[17px] tracking-[-0.2px] text-ink truncate">
                  {job.title}
                </p>
                <p className="text-footnote text-ink-subtle mt-0.5">
                  {qs.length} pergunta{qs.length === 1 ? '' : 's'} da vaga
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onManual(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-line-soft bg-white text-caption font-semibold text-ink hover:border-line transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => onGerar(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sky-600 text-white text-caption font-semibold hover:bg-sky-700 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerar perguntas da vaga
                </button>
              </div>
            </div>

            {qs.length === 0 ? (
              <p className="text-footnote text-ink-subtle italic">
                Sem perguntas técnicas ainda pra essa vaga.
              </p>
            ) : (
              <div className="space-y-3">
                {qs.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    index={i}
                    data={q}
                    onSave={async (patch) => {
                      const { error } = await updateJobQuestion(q.id, patch);
                      if (error) {
                        toast.error(error.message);
                        return false;
                      }
                      await onChanged();
                      return true;
                    }}
                    onDelete={async () => {
                      const { error } = await deleteJobQuestion(q.id);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      toast.success('Pergunta removida.');
                      await onChanged();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function QuestionCard({
  index,
  data,
  onSave,
  onDelete,
}: {
  index: number;
  data: EditableQuestion;
  onSave: (patch: QuestionPatch) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState(data.question);
  const [guidance, setGuidance] = useState(data.guidance ?? '');
  const [rubric, setRubric] = useState(data.scoring_rubric ?? '');
  const [required, setRequired] = useState(data.required);
  const [optionsText, setOptionsText] = useState((data.options ?? []).join('\n'));

  function startEdit() {
    setQuestion(data.question);
    setGuidance(data.guidance ?? '');
    setRubric(data.scoring_rubric ?? '');
    setRequired(data.required);
    setOptionsText((data.options ?? []).join('\n'));
    setExpanded(true);
    setEditing(true);
  }

  async function handleSave() {
    if (question.trim().length === 0) {
      toast.error('A pergunta não pode ficar vazia.');
      return;
    }
    const patch: QuestionPatch = {
      question: question.trim(),
      guidance: guidance.trim() || null,
      scoring_rubric: rubric.trim() || null,
      required,
    };
    if (isSelectFormat(data.format)) {
      const options = optionsText
        .split('\n')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      if (options.length < 2) {
        toast.error('Pergunta de seleção precisa de pelo menos 2 opções.');
        return;
      }
      patch.options = options;
    }
    setSaving(true);
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) setEditing(false);
  }

  async function handleDelete() {
    const ok = window.confirm('Remover essa pergunta?');
    if (!ok) return;
    await onDelete();
  }

  return (
    <div className="rounded-card border border-line-soft bg-canvas p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-6 min-w-6 px-2 items-center justify-center rounded-full bg-sky-600 text-white text-caption font-bold shrink-0 mt-1">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          {editing ? (
            <>
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setRequired((v) => !v)}
                  aria-pressed={required}
                  className={
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-eyebrow font-bold uppercase transition-colors ' +
                    (required
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-line-soft bg-white text-ink-subtle hover:text-ink')
                  }
                >
                  Obrigatória
                </button>
              </div>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                className="rounded-lg border-line-soft bg-white text-callout leading-relaxed resize-none"
              />
              {isSelectFormat(data.format) && (
                <div className="mt-2">
                  <label className="block text-eyebrow font-bold uppercase text-ink-subtle mb-1.5">
                    Opções (uma por linha)
                  </label>
                  <Textarea
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    rows={4}
                    className="rounded-lg border-line-soft bg-white text-footnote leading-relaxed resize-none"
                  />
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="block w-full text-left"
              aria-expanded={expanded}
            >
              {(data.required || FORMAT_LABEL[data.format]) && (
                <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {data.required && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-eyebrow font-bold uppercase text-amber-700">
                      Obrigatória
                    </span>
                  )}
                  {FORMAT_LABEL[data.format] && (
                    <span className="inline-flex items-center rounded-full border border-line-soft bg-white px-2 py-0.5 text-eyebrow font-bold uppercase text-ink-muted">
                      {FORMAT_LABEL[data.format]}
                    </span>
                  )}
                </span>
              )}
              <p className="text-callout text-ink leading-relaxed whitespace-pre-wrap">
                {data.question}
              </p>
              {isSelectFormat(data.format) && (data.options ?? []).length > 0 && (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {(data.options ?? []).map((opt) => (
                    <span
                      key={opt}
                      className="inline-flex items-center rounded-lg border border-line-soft bg-white px-2 py-0.5 text-caption text-ink-muted"
                    >
                      {opt}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? null : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="h-7 w-7 rounded-full flex items-center justify-center text-ink-subtle hover:bg-white hover:text-ink transition-colors"
              aria-label={expanded ? 'Recolher critérios' : 'Ver critérios internos'}
              aria-expanded={expanded}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
          {!editing && (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="h-7 w-7 rounded-full flex items-center justify-center text-ink-subtle hover:bg-white hover:text-ink transition-colors"
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-7 w-7 rounded-full flex items-center justify-center text-ink-subtle hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-line-soft/70 pt-3 pl-9">
          {editing ? (
            <>
              <div>
                <label className="block text-eyebrow font-bold uppercase text-ink-subtle mb-1.5">
                  Resposta esperada (interno)
                </label>
                <Textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={2}
                  className="rounded-lg border-line-soft bg-white text-footnote leading-relaxed resize-none"
                />
              </div>
              <div>
                <label className="block text-eyebrow font-bold uppercase text-ink-subtle mb-1.5">
                  Como pontuar (interno)
                </label>
                <Textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  rows={2}
                  className="rounded-lg border-line-soft bg-white text-footnote leading-relaxed resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-600 text-white text-caption font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line-soft bg-white text-caption font-semibold text-ink-muted hover:text-ink transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-0.5">
                  Resposta esperada
                </p>
                {data.guidance ? (
                  <p className="text-footnote text-ink-muted leading-relaxed whitespace-pre-wrap">
                    {data.guidance}
                  </p>
                ) : (
                  <p className="text-footnote text-[#a8a8ad] italic">Ainda não preenchida.</p>
                )}
              </div>
              <div>
                <p className="text-eyebrow font-bold uppercase text-ink-subtle mb-0.5">
                  Como pontuar
                </p>
                {data.scoring_rubric ? (
                  <p className="text-footnote text-ink-muted leading-relaxed whitespace-pre-wrap">
                    {data.scoring_rubric}
                  </p>
                ) : (
                  <p className="text-footnote text-[#a8a8ad] italic">Ainda não preenchida.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Questions;
