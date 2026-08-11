import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  XCircle,
  FileText,
  Linkedin,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/hooks/use-company';
import { useAuth } from '@/hooks/use-auth';
import {
  useApplications,
  analysisIsPending,
  type ApplicationWithAnalysis,
} from '@/hooks/use-applications';
import { parseDimensions, overallFromDimensions } from '@/lib/scout-areas';
import { ScoutCard } from '@/components/scout-card';
import { BrandCtaButton } from '@/components/brand-cta';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ApplicationStatus, ApplicationEventType, HighlightType } from '@/types/database';

type Job = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  highlight_question: string | null;
  highlight_type: HighlightType | null;
};

type AppEvent = {
  id: string;
  type: ApplicationEventType;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

const STAGE_ORDER: ApplicationStatus[] = [
  'triagem',
  'entrevista',
  'proposta',
  'contratado',
  'reprovado',
];

const stageLabels: Record<ApplicationStatus, string> = {
  triagem: 'Triagem',
  entrevista: 'Entrevista',
  proposta: 'Proposta',
  contratado: 'Contratado',
  reprovado: 'Reprovado',
};

const stageChipColors: Record<ApplicationStatus, string> = {
  triagem: 'bg-gray-100 text-[#6b6b70] border-gray-200',
  entrevista: 'bg-sky-50 text-sky-700 border-sky-200',
  proposta: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  contratado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reprovado: 'bg-rose-50 text-rose-700 border-rose-200',
};

const NEXT_STAGE: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  triagem: 'entrevista',
  entrevista: 'proposta',
};

const recColors: Record<string, string> = {
  strong_hire: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  hire: 'bg-sky-50 text-sky-700 border-sky-200',
  maybe: 'bg-amber-50 text-amber-700 border-amber-200',
  no_hire: 'bg-rose-50 text-rose-700 border-rose-200',
};

const recLabels: Record<string, string> = {
  strong_hire: 'Contratação forte',
  hire: 'Contratar',
  maybe: 'Talvez',
  no_hire: 'Não contratar',
};

const STUCK_ANALYSIS_MS = 2 * 60 * 1000;

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const [job, setJob] = useState<Job | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<'all' | ApplicationStatus>('all');

  const { applications, loading: appsLoading, refetch, patchApplication } = useApplications(id);

  useEffect(() => {
    async function loadJob() {
      if (!id) return;
      const { data } = await supabase
        .from('jobs')
        .select('id, slug, title, description, status, created_at, highlight_question, highlight_type')
        .eq('id', id)
        .maybeSingle<Job>();
      setJob(data);
      setJobLoading(false);
    }
    void loadJob();
  }, [id]);

  if (jobLoading || appsLoading) {
    return <div className="p-8 text-[#8a8a8f] text-sm">Carregando...</div>;
  }
  if (!job) {
    return <div className="p-8 text-[#6b6b70]">Vaga não encontrada.</div>;
  }

  const counts = STAGE_ORDER.reduce(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<ApplicationStatus, number>,
  );

  const filtered =
    stageFilter === 'all' ? applications : applications.filter((a) => a.status === stageFilter);

  const selected = applications.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-6xl mx-auto px-8 py-10">
        <button
          onClick={() => navigate('/app/jobs')}
          className="inline-flex items-center gap-2 text-[14px] font-medium text-[#6b6b70] hover:text-[#1d1d1f] transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar pras vagas
        </button>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3">
              Vaga
            </p>
            <h1 className="font-satoshi font-bold text-[36px] md:text-[44px] tracking-[-0.7px] leading-[1.1] text-[#1d1d1f]">
              {job.title}
            </h1>
            <p className="text-[14px] text-[#8a8a8f] mt-3">
              {applications.length} candidato{applications.length === 1 ? '' : 's'} · status:{' '}
              {job.status}
            </p>
          </div>
          {company && job.status === 'active' && (
            <a
              href={`/careers/${company.slug}/${job.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-[13px] font-semibold text-[#1d1d1f] hover:border-gray-400 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Career page
            </a>
          )}
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-[28px] border border-gray-200 p-12 text-center">
            <p className="text-[16px] font-semibold text-[#1d1d1f] mb-2">Nenhum candidato ainda</p>
            <p className="text-[14px] text-[#6b6b70] max-w-md mx-auto mb-5">
              Compartilhe a career page. Toda aplicação dispara análise da IA automaticamente.
            </p>
            {company && (
              <code className="text-[12px] bg-gray-100 px-3 py-1.5 rounded-md text-[#1d1d1f] inline-block">
                {window.location.origin}/careers/{company.slug}/{job.slug}
              </code>
            )}
          </div>
        ) : (
          <>
            {/* Filtro por etapa */}
            <div className="flex flex-wrap gap-2 mb-6">
              <StagePill
                label="Todas"
                count={applications.length}
                active={stageFilter === 'all'}
                onClick={() => setStageFilter('all')}
              />
              {STAGE_ORDER.map((s) => (
                <StagePill
                  key={s}
                  label={stageLabels[s]}
                  count={counts[s]}
                  active={stageFilter === s}
                  onClick={() => setStageFilter(s)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
              {/* Lista */}
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                    <p className="text-[13px] text-[#6b6b70]">Nenhum candidato nessa etapa.</p>
                  </div>
                ) : (
                  filtered.map((app) => {
                    const score = app.ai_analysis?.score;
                    const aStatus = app.ai_analysis?.status;
                    const isPending = analysisIsPending(app);
                    const hasError = aStatus === 'error';
                    const isSelected = selectedId === app.id;
                    return (
                      <button
                        key={app.id}
                        onClick={() => setSelectedId(app.id)}
                        className={cn(
                          'w-full text-left p-4 rounded-2xl border transition-all',
                          isSelected
                            ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-500/20'
                            : 'border-gray-200 bg-white hover:border-gray-400',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[14px] text-[#1d1d1f] truncate">
                              {app.candidate_name}
                            </p>
                            <p className="text-[12px] text-[#8a8a8f] truncate mt-0.5">
                              {app.candidate_email}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#8a8a8f]">
                                <Clock className="h-3 w-3 animate-pulse" />
                                Analisando
                              </span>
                            )}
                            {hasError && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                                <AlertCircle className="h-3 w-3" />
                                Erro
                              </span>
                            )}
                            {aStatus === 'completed' && score !== null && score !== undefined && (
                              <p className="font-satoshi font-black text-[22px] tracking-[-0.4px] text-[#1d1d1f] leading-none">
                                {score}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                              stageChipColors[app.status],
                            )}
                          >
                            {stageLabels[app.status]}
                          </span>
                          {app.ai_suspected && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700"
                              title="A resposta contém a palavra-canário escondida no enunciado. Provável uso de IA pra gerar a resposta."
                            >
                              <AlertCircle className="h-3 w-3" />
                              IA suspeita
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Detalhe */}
              <div>
                {selected ? (
                  <CandidateDetail
                    key={selected.id}
                    app={selected}
                    jobTitle={job.title}
                    highlightQuestion={job.highlight_question}
                    highlightType={job.highlight_type}
                    refetch={refetch}
                    patchApplication={patchApplication}
                  />
                ) : (
                  <div className="bg-white rounded-[28px] border border-gray-200 p-12 text-center">
                    <p className="text-[14px] text-[#6b6b70]">
                      Selecione um candidato pra ver a análise.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StagePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[13px] font-semibold transition-colors',
        active
          ? 'bg-[#1d1d1f] border-[#1d1d1f] text-white'
          : 'bg-white border-gray-200 text-[#6b6b70] hover:border-gray-400 hover:text-[#1d1d1f]',
      )}
    >
      {label}
      <span
        className={cn(
          'inline-flex min-w-[20px] justify-center rounded-full px-1.5 py-px text-[11px] font-bold',
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#8a8a8f]',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CandidateDetail({
  app,
  jobTitle,
  highlightQuestion,
  highlightType,
  refetch,
  patchApplication,
}: {
  app: ApplicationWithAnalysis;
  jobTitle: string;
  highlightQuestion: string | null;
  highlightType: HighlightType | null;
  refetch: () => Promise<void>;
  patchApplication: (id: string, patch: Partial<ApplicationWithAnalysis>) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [loadingResume, setLoadingResume] = useState(false);

  async function openResume() {
    setLoadingResume(true);
    try {
      const { data, error } = await supabase.functions.invoke('resume-url', {
        body: { applicationId: app.id },
      });
      if (error) throw error;
      if (!data?.ok || !data.url) throw new Error(data?.error ?? 'Falha ao gerar link');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Não deu pra abrir o currículo. Tente de novo.');
    } finally {
      setLoadingResume(false);
    }
  }

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('application_events')
      .select('id, type, from_status, to_status, note, created_at')
      .eq('application_id', app.id)
      .order('created_at', { ascending: true });
    setEvents((data as AppEvent[]) ?? []);
  }, [app.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function applyStageChange(
    to: ApplicationStatus,
    opts?: { note?: string; eventType?: 'stage_change' | 'hired' },
  ): Promise<boolean> {
    const from = app.status;
    if (from === to) return false;
    patchApplication(app.id, { status: to });

    const { error: updError } = await supabase
      .from('applications')
      .update({ status: to })
      .eq('id', app.id);

    if (updError) {
      patchApplication(app.id, { status: from });
      toast.error('Não deu pra atualizar a etapa. Tente de novo.');
      return false;
    }

    // Nota interna vai num evento separado (type 'note'). A policy de leitura do
    // candidato só expõe stage_change sem nota, então a nota nunca vaza pra ele.
    const noteText = opts?.note?.trim() ? opts.note.trim() : null;
    const { error: evError } = await supabase.from('application_events').insert([
      {
        application_id: app.id,
        company_id: app.company_id,
        actor_id: user?.id ?? null,
        type: opts?.eventType ?? 'stage_change',
        from_status: from,
        to_status: to,
        note: null,
      },
      ...(noteText
        ? [
            {
              application_id: app.id,
              company_id: app.company_id,
              actor_id: user?.id ?? null,
              type: 'note' as const,
              from_status: null,
              to_status: null,
              note: noteText,
            },
          ]
        : []),
    ]);
    if (evError) {
      console.error('[JobDetail] event insert error:', evError);
    }
    void loadEvents();
    return true;
  }

  async function advance(to: ApplicationStatus) {
    setBusy(true);
    const ok = await applyStageChange(to);
    if (ok) toast.success(`Movido pra ${stageLabels[to]}`);
    setBusy(false);
  }

  async function reject() {
    setBusy(true);
    const ok = await applyStageChange('reprovado', { note: rejectNote });
    if (ok) {
      toast('Candidato reprovado');
      setRejecting(false);
      setRejectNote('');
    }
    setBusy(false);
  }

  async function hire() {
    setBusy(true);
    const ok = await applyStageChange('contratado', { eventType: 'hired' });
    if (!ok) {
      setBusy(false);
      return;
    }

    const { data: collab, error: colError } = await supabase
      .from('collaborators')
      .insert({
        company_id: app.company_id,
        candidate_id: app.candidate_id,
        application_id: app.id,
        full_name: app.candidate_name,
        email: app.candidate_email,
        role_title: jobTitle,
      })
      .select('id')
      .single();

    if (colError) {
      if (colError.code === '23505') {
        toast.info('Essa pessoa já está no time.');
      } else {
        console.error('[JobDetail] collaborator insert error:', colError);
        toast.error('Etapa atualizada, mas não deu pra adicionar a pessoa ao time.');
      }
    } else if (collab) {
      const dims = parseDimensions(app.ai_analysis?.dimensions);
      if (dims.length > 0) {
        const { error: scoreError } = await supabase.from('collaborator_scores').insert(
          dims.map((d) => ({
            collaborator_id: collab.id,
            company_id: app.company_id,
            area: d.area,
            score: d.score,
            source: 'analise_inicial' as const,
          })),
        );
        if (scoreError) {
          console.error('[JobDetail] collaborator_scores insert error:', scoreError);
        }
      }
      toast.success(`${app.candidate_name} agora faz parte do time!`, {
        action: { label: 'Ver time', onClick: () => navigate('/app/time') },
      });
    }
    setBusy(false);
  }

  async function reanalyze() {
    setBusy(true);
    const { error } = await supabase.functions.invoke('analyze-candidate', {
      body: { applicationId: app.id },
    });
    if (error) {
      toast.error('Não deu pra disparar a re-análise. Tente de novo.');
    } else {
      toast.success('Re-análise disparada. O resultado aparece aqui em instantes.');
      await refetch();
    }
    setBusy(false);
  }

  const analysis = app.ai_analysis;
  const aStatus = analysis?.status;
  const pendingAnalysis = analysisIsPending(app);
  const pendingSince = analysis?.ran_at ?? app.created_at;
  const stuckAnalysis =
    pendingAnalysis && Date.now() - new Date(pendingSince).getTime() > STUCK_ANALYSIS_MS;
  const dims = aStatus === 'completed' ? parseDimensions(analysis?.dimensions) : [];

  const next = NEXT_STAGE[app.status];
  const isFinal = app.status === 'contratado' || app.status === 'reprovado';

  const timeline: { key: string; label: string; date: string; note: string | null }[] = [
    {
      key: 'received',
      label: 'Candidatura recebida',
      date: app.created_at,
      note: null,
    },
    ...events.map((e) => ({
      key: e.id,
      label: eventLabel(e),
      date: e.created_at,
      note: e.note,
    })),
  ];

  return (
    <div className="bg-white rounded-[28px] border border-gray-200 p-8 sticky top-8">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-satoshi font-bold text-[24px] tracking-[-0.4px] text-[#1d1d1f] truncate">
              {app.candidate_name}
            </h2>
            <p className="text-[13px] text-[#8a8a8f] mt-1 truncate">{app.candidate_email}</p>
          </div>
          <span
            className={cn(
              'flex-shrink-0 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border mt-1',
              stageChipColors[app.status],
            )}
          >
            {stageLabels[app.status]}
          </span>
        </div>

        {(app.resume_path || app.linkedin_url) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {app.resume_path && (
              <button
                type="button"
                onClick={() => void openResume()}
                disabled={loadingResume}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:border-gray-400 disabled:opacity-50"
              >
                {loadingResume ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Ver currículo
              </button>
            )}
            {app.linkedin_url && (
              <a
                href={app.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#0A66C2] transition-colors hover:border-gray-400"
              >
                <Linkedin className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                LinkedIn
              </a>
            )}
          </div>
        )}
      </div>

      {/* Ações de etapa */}
      {isFinal ? (
        app.status === 'contratado' ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
            <p className="text-[13px] font-medium text-emerald-800 flex-1">
              Contratado. Agora faz parte do time.
            </p>
            <button
              onClick={() => navigate('/app/time')}
              className="text-[13px] font-semibold text-emerald-700 hover:text-emerald-900 transition-colors whitespace-nowrap"
            >
              Ver time
            </button>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <XCircle className="h-4 w-4 flex-shrink-0 text-[#8a8a8f]" />
            <p className="text-[13px] font-medium text-[#6b6b70]">
              Candidato reprovado nessa vaga.
            </p>
          </div>
        )
      ) : (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {app.status === 'proposta' && (
              <BrandCtaButton size="sm" onClick={() => void hire()} disabled={busy}>
                Contratar
              </BrandCtaButton>
            )}
            {next && (
              <button
                onClick={() => void advance(next)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Avançar pra {stageLabels[next]}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
            <button
              onClick={() => setRejecting((v) => !v)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reprovar
            </button>
          </div>

          {rejecting && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-[12px] font-semibold text-[#1d1d1f] mb-2">
                Quer registrar o motivo? (opcional)
              </p>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Ex.: perfil distante do que a vaga pede agora."
                rows={2}
                className="bg-white text-[13px] mb-3"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void reject()}
                  disabled={busy}
                  className="rounded-full bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Confirmar reprovação
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectNote('');
                  }}
                  disabled={busy}
                  className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#6b6b70] transition-colors hover:text-[#1d1d1f] disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {highlightQuestion && app.highlight_answer && (
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-2">
            Pergunta de destaque
          </p>
          <p className="text-[13px] font-medium text-[#6b6b70] mb-2">{highlightQuestion}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-[#1d1d1f]">
              {formatHighlightAnswer(app.highlight_answer, highlightType)}
            </span>
            {app.highlight_matched === false && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <AlertCircle className="h-3 w-3" />
                Fora do critério de destaque
              </span>
            )}
            {app.highlight_matched === true && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
          </div>
        </div>
      )}

      {app.why_interested && (
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-2">
            Por que está interessado
          </p>
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
            {app.why_interested}
          </p>
        </div>
      )}

      <div className="border-t border-gray-100 pt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-3 flex items-center gap-2">
          Análise IA
          {aStatus === 'completed' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
        </p>

        {pendingAnalysis ? (
          <div>
            <p className="text-[14px] text-[#8a8a8f] flex items-center gap-2">
              <Clock className="h-4 w-4 animate-pulse" />
              Análise rodando. O resultado aparece aqui em instantes.
            </p>
            {stuckAnalysis && (
              <button
                onClick={() => void reanalyze()}
                disabled={busy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:border-gray-400 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-analisar
              </button>
            )}
          </div>
        ) : aStatus === 'error' ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <p className="text-[13px] font-semibold text-rose-700 mb-1">Erro na análise</p>
            <p className="text-[12px] text-rose-600 mb-3">{analysis?.error_message}</p>
            <button
              onClick={() => void reanalyze()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-4 py-2 text-[13px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-analisar
            </button>
          </div>
        ) : dims.length > 0 ? (
          <div>
            <ScoutCard
              name={app.candidate_name}
              subtitle={jobTitle}
              overall={analysis?.score ?? overallFromDimensions(dims) ?? 0}
              dimensions={dims}
              badge={
                analysis?.recommendation
                  ? (recLabels[analysis.recommendation] ?? analysis.recommendation)
                  : null
              }
            />
            {analysis?.reasoning && (
              <p className="mt-5 text-[14px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
                {analysis.reasoning}
              </p>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-3 mb-4">
              <p className="font-satoshi font-black text-[44px] tracking-[-0.8px] text-[#1d1d1f] leading-none">
                {analysis?.score}
              </p>
              <p className="text-[14px] text-[#8a8a8f]">/ 100</p>
              {analysis?.recommendation && (
                <span
                  className={cn(
                    'ml-auto inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border',
                    recColors[analysis.recommendation] ?? '',
                  )}
                >
                  {recLabels[analysis.recommendation] ?? analysis.recommendation}
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#1d1d1f] leading-relaxed whitespace-pre-wrap">
              {analysis?.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Linha do tempo */}
      <div className="border-t border-gray-100 pt-6 mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8f] mb-4">
          Linha do tempo
        </p>
        <ol className="space-y-4">
          {timeline.map((entry, i) => (
            <li key={entry.key} className="relative flex gap-3 pl-1">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                    i === timeline.length - 1 ? 'bg-sky-500' : 'bg-gray-300',
                  )}
                />
                {i < timeline.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight">
                  {entry.label}
                </p>
                <p className="text-[11px] text-[#8a8a8f] mt-0.5">{formatEventDate(entry.date)}</p>
                {entry.note && (
                  <p className="mt-1 text-[13px] text-[#6b6b70] leading-relaxed whitespace-pre-wrap">
                    {entry.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function formatHighlightAnswer(answer: string, type: HighlightType | null): string {
  if (type === 'yes_no') {
    if (answer === 'sim') return 'Sim';
    if (answer === 'nao') return 'Não';
  }
  return answer;
}

function eventLabel(e: AppEvent): string {
  if (e.type === 'hired') return 'Contratado';
  if (e.type === 'note') return 'Nota';
  const to = e.to_status as ApplicationStatus | null;
  if (to === 'reprovado') return 'Reprovado';
  if (to && stageLabels[to]) return `Movido pra ${stageLabels[to]}`;
  return 'Mudança de etapa';
}

export default JobDetail;
