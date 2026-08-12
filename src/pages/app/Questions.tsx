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
import type { QuestionKind } from '@/types/database';

type JobLite = { id: string; title: string };

type EditableQuestion = {
  id: string;
  question: string;
  guidance: string | null;
  scoring_rubric: string | null;
  required: boolean;
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

  const cultureQuestions = useMemo(
    () => companyQuestions.filter((q) => q.kind === 'culture'),
    [companyQuestions],
  );
  const reasoningQuestions = useMemo(
    () => companyQuestions.filter((q) => q.kind === 'reasoning'),
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
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
            Perguntas
          </p>
          <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
            Banco de perguntas
          </h1>
          <p className="text-[16px] text-[#6b6b70] mt-3 max-w-xl leading-relaxed">
            Essas perguntas entram no formulário de candidatura. Todo candidato responde as mesmas,
            então a comparação fica justa. A IA gera com base no DNA da sua empresa e usa a resposta
            esperada pra pontuar cada candidato.
          </p>
        </div>

        <Tabs defaultValue="company">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Cultura e raciocínio</TabsTrigger>
            <TabsTrigger value="job">Por vaga</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <UnifiedCompanyPanel
              cultureQuestions={cultureQuestions}
              reasoningQuestions={reasoningQuestions}
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
  cultureQuestions,
  reasoningQuestions,
  loading,
  onGerar,
  onManual,
  onChanged,
}: {
  cultureQuestions: CompanyQuestion[];
  reasoningQuestions: CompanyQuestion[];
  loading: boolean;
  onGerar: () => void;
  onManual: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const total = cultureQuestions.length + reasoningQuestions.length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <p className="text-[14px] text-[#6b6b70] leading-relaxed max-w-md">
          Perguntas de cultura (ética de trabalho e fit com o DNA) e de raciocínio lógico, geradas
          juntas e padronizadas pra todo candidato.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onManual}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-[#1d1d1f] hover:border-gray-400 transition-colors"
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
        <div className="text-[#8a8a8f] text-sm">Carregando...</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-[28px] border border-gray-200 p-10 text-center">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gray-100 items-center justify-center mb-4">
            <ListChecks className="h-6 w-6 text-[#6b6b70]" strokeWidth={1.5} />
          </div>
          <p className="text-[18px] font-semibold text-[#1d1d1f] mb-2">
            Nenhuma pergunta de cultura ou raciocínio ainda
          </p>
          <p className="text-[14px] text-[#6b6b70] mb-6 max-w-md mx-auto leading-relaxed">
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
          <KindGroup
            kind="culture"
            questions={cultureQuestions}
            onChanged={onChanged}
          />
          <KindGroup
            kind="reasoning"
            questions={reasoningQuestions}
            onChanged={onChanged}
          />
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
        <span className="text-[13px] text-[#8a8a8f] font-medium">
          {questions.length} pergunta{questions.length === 1 ? '' : 's'}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-[13px] text-[#a8a8ad] italic">
          Nenhuma pergunta de {kind === 'culture' ? 'cultura' : 'raciocínio'} ainda.
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
  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-[28px] border border-gray-200 p-10 text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-gray-100 items-center justify-center mb-4">
          <Briefcase className="h-6 w-6 text-[#6b6b70]" strokeWidth={1.5} />
        </div>
        <p className="text-[18px] font-semibold text-[#1d1d1f] mb-2">Nenhuma vaga ainda</p>
        <p className="text-[14px] text-[#6b6b70] max-w-md mx-auto leading-relaxed">
          Crie uma vaga primeiro. Cada vaga ganha perguntas técnicas específicas, além das
          perguntas de cultura e raciocínio da empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-[#6b6b70] leading-relaxed max-w-xl">
        Perguntas técnicas específicas de cada vaga. Entram no formulário junto com as perguntas de
        cultura e raciocínio da empresa.
      </p>
      {jobs.map((job) => {
        const qs = jobQuestions.filter((q) => q.job_id === job.id);
        return (
          <div key={job.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <p className="font-satoshi font-bold text-[17px] tracking-[-0.2px] text-[#1d1d1f] truncate">
                  {job.title}
                </p>
                <p className="text-[13px] text-[#8a8a8f] mt-0.5">
                  {qs.length} pergunta{qs.length === 1 ? '' : 's'} da vaga
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onManual(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 bg-white text-[12px] font-semibold text-[#1d1d1f] hover:border-gray-400 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => onGerar(job.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sky-600 text-white text-[12px] font-semibold hover:bg-sky-700 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerar perguntas da vaga
                </button>
              </div>
            </div>

            {qs.length === 0 ? (
              <p className="text-[13px] text-[#8a8a8f] italic">
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
      })}
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

  function startEdit() {
    setQuestion(data.question);
    setGuidance(data.guidance ?? '');
    setRubric(data.scoring_rubric ?? '');
    setRequired(data.required);
    setExpanded(true);
    setEditing(true);
  }

  async function handleSave() {
    if (question.trim().length === 0) {
      toast.error('A pergunta não pode ficar vazia.');
      return;
    }
    setSaving(true);
    const ok = await onSave({
      question: question.trim(),
      guidance: guidance.trim() || null,
      scoring_rubric: rubric.trim() || null,
      required,
    });
    setSaving(false);
    if (ok) setEditing(false);
  }

  async function handleDelete() {
    const ok = window.confirm('Remover essa pergunta?');
    if (!ok) return;
    await onDelete();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-6 min-w-6 px-2 items-center justify-center rounded-full bg-sky-600 text-white text-[11px] font-bold shrink-0 mt-1">
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
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ' +
                    (required
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-gray-200 bg-white text-[#8a8a8f] hover:text-[#1d1d1f]')
                  }
                >
                  Obrigatória
                </button>
              </div>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                className="rounded-lg border-gray-200 bg-white text-[14px] leading-relaxed resize-none"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="block w-full text-left"
              aria-expanded={expanded}
            >
              {data.required && (
                <span className="mb-1.5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Obrigatória
                </span>
              )}
              <p className="text-[15px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                {data.question}
              </p>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? null : (
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
          )}
          {!editing && (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="h-7 w-7 rounded-full flex items-center justify-center text-[#8a8a8f] hover:bg-white hover:text-[#1d1d1f] transition-colors"
                aria-label="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-7 w-7 rounded-full flex items-center justify-center text-[#8a8a8f] hover:bg-red-50 hover:text-red-600 transition-colors"
                aria-label="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-200/70 pt-3 pl-9">
          {editing ? (
            <>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-1.5">
                  Resposta esperada (interno)
                </label>
                <Textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={2}
                  className="rounded-lg border-gray-200 bg-white text-[13px] leading-relaxed resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-1.5">
                  Como pontuar (interno)
                </label>
                <Textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  rows={2}
                  className="rounded-lg border-gray-200 bg-white text-[13px] leading-relaxed resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-600 text-white text-[12px] font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-semibold text-[#6b6b70] hover:text-[#1d1d1f] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-0.5">
                  Resposta esperada
                </p>
                {data.guidance ? (
                  <p className="text-[13px] text-[#6b6b70] leading-relaxed whitespace-pre-wrap">
                    {data.guidance}
                  </p>
                ) : (
                  <p className="text-[13px] text-[#a8a8ad] italic">Ainda não preenchida.</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-0.5">
                  Como pontuar
                </p>
                {data.scoring_rubric ? (
                  <p className="text-[13px] text-[#6b6b70] leading-relaxed whitespace-pre-wrap">
                    {data.scoring_rubric}
                  </p>
                ) : (
                  <p className="text-[13px] text-[#a8a8ad] italic">Ainda não preenchida.</p>
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
