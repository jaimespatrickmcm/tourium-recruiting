// Minhas candidaturas: lista de aplicações do candidato logado, com progresso
// por etapa (triagem → entrevista → proposta → contratado) e mini timeline
// vinda de application_events. Mobile-first.

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { ApplicationStatus } from '@/types/database';

const STAGES = [
  { key: 'triagem', label: 'Triagem' },
  { key: 'fit_cultural', label: 'Fit cultural' },
  { key: 'entrevista', label: 'Entrevista' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'contratado', label: 'Contratado' },
] as const;

type ApplicationRow = {
  id: string;
  job_id: string;
  company_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  application_id: string;
  type: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function stageLabel(status: string | null): string {
  return STAGES.find((s) => s.key === status)?.label ?? status ?? '';
}

function eventLine(e: EventRow): string {
  const d = shortDate(e.created_at);
  if (e.to_status === 'reprovado') return `Processo encerrado em ${d}`;
  if (e.to_status === 'contratado') return `Contratado em ${d}`;
  return `Movido pra ${stageLabel(e.to_status)} em ${d}`;
}

function StageProgress({ status }: { status: ApplicationStatus }) {
  const rejected = status === 'reprovado';
  const currentIndex = rejected ? -1 : STAGES.findIndex((s) => s.key === status);

  return (
    <div className="flex items-start">
      {STAGES.map((stage, i) => {
        const filled = !rejected && i <= currentIndex;
        const done = !rejected && i < currentIndex;
        const isCurrent = !rejected && i === currentIndex;
        return (
          <div key={stage.key} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div
                className={cn(
                  'absolute top-[11px] right-1/2 w-full h-0.5 -translate-y-1/2',
                  filled ? 'holo-gradient' : 'bg-gray-200',
                )}
              />
            )}
            <div
              className={cn(
                'relative z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 bg-white',
                filled ? 'border-sky-500' : 'border-line-soft',
                isCurrent && 'bg-sky-500',
              )}
            >
              {done && <Check className="h-3 w-3 text-sky-600" strokeWidth={3} />}
              {isCurrent && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
            <span
              className={cn(
                'mt-1.5 text-[10px] sm:text-caption font-semibold text-center leading-tight',
                filled ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ApplicationCard({
  app,
  jobTitle,
  companyName,
  events,
}: {
  app: ApplicationRow;
  jobTitle: string;
  companyName: string | null;
  events: EventRow[];
}) {
  const [open, setOpen] = useState(false);
  const rejected = app.status === 'reprovado';
  const timelineCount = events.length + 1; // +1 pela linha de envio

  return (
    <div className="bg-white rounded-card border border-line-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-satoshi font-bold text-[17px] leading-snug text-ink truncate">
            {jobTitle}
          </h2>
          <p className="text-footnote text-ink-muted mt-0.5">
            {companyName ? `${companyName} · ` : ''}Enviada em {fullDate(app.created_at)}
          </p>
        </div>
        {rejected && (
          <span className="shrink-0 rounded-full bg-surface-sunken border border-line-soft px-2.5 py-1 text-caption font-semibold text-ink-muted">
            Encerrado
          </span>
        )}
      </div>

      <div className="mt-5">
        {rejected ? (
          <div className="rounded-tile bg-canvas border border-line-soft px-4 py-3">
            <p className="text-sm font-semibold text-ink">Processo encerrado nessa vaga</p>
            <p className="text-footnote text-ink-muted mt-0.5">
              Obrigado por participar. Seu perfil segue disponível pra futuras oportunidades.
            </p>
          </div>
        ) : (
          <StageProgress status={app.status} />
        )}
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-footnote font-semibold text-sky-700 hover:text-sky-800"
          aria-expanded={open}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? 'Esconder histórico' : `Ver histórico (${timelineCount})`}
        </button>
        {open && (
          <ol className="mt-3 space-y-2">
            <li className="flex items-center gap-2.5 text-footnote text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
              Candidatura enviada em {shortDate(app.created_at)}
            </li>
            {events.map((e, i) => (
              <li
                key={`${e.created_at}-${i}`}
                className="flex items-center gap-2.5 text-footnote text-ink"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    e.to_status === 'reprovado' ? 'bg-gray-400' : 'bg-sky-500',
                  )}
                />
                {eventLine(e)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function CandidateApplications() {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [eventsByApp, setEventsByApp] = useState<Record<string, EventRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('id, job_id, company_id, status, created_at, updated_at')
      .eq('candidate_id', user.id)
      .order('created_at', { ascending: false });

    if (appError) {
      setError('Não conseguimos carregar suas candidaturas agora.');
      setLoading(false);
      return;
    }

    const rows = (appData ?? []) as ApplicationRow[];
    setApps(rows);

    if (rows.length === 0) {
      setLoading(false);
      return;
    }

    const appIds = rows.map((a) => a.id);
    const jobIds = [...new Set(rows.map((a) => a.job_id))];
    const companyIds = [...new Set(rows.map((a) => a.company_id))];

    const [jobsRes, companiesRes, eventsRes] = await Promise.all([
      supabase.from('jobs').select('id, title').in('id', jobIds),
      supabase.from('company_public_profiles').select('id, name').in('id', companyIds),
      supabase
        .from('application_events')
        .select('application_id, type, from_status, to_status, created_at')
        .in('application_id', appIds)
        .order('created_at', { ascending: true }),
    ]);

    const titles: Record<string, string> = {};
    for (const j of jobsRes.data ?? []) titles[j.id] = j.title;
    setJobTitles(titles);

    const names: Record<string, string> = {};
    for (const c of companiesRes.data ?? []) names[c.id] = c.name;
    setCompanyNames(names);

    const grouped: Record<string, EventRow[]> = {};
    for (const e of (eventsRes.data ?? []) as EventRow[]) {
      if (e.type === 'note' || !e.to_status) continue;
      (grouped[e.application_id] ??= []).push(e);
    }
    setEventsByApp(grouped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void fetchAll();
  }, [authLoading, fetchAll]);

  if (authLoading || loading) {
    return <div className="text-sm text-ink-muted">Carregando...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink">{error}</p>
        <button
          type="button"
          onClick={() => void fetchAll()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-satoshi text-2xl font-bold text-ink mb-1">Minhas candidaturas</h1>
        <p className="text-sm text-ink-muted">Acompanhe em que etapa você está em cada vaga.</p>
      </div>

      {apps.length === 0 ? (
        <div className="bg-white rounded-card border border-line-soft p-8 text-center">
          <p className="text-sm text-ink-muted">
            Você ainda não se candidatou a nenhuma vaga. Quando se candidatar pela página de
            carreiras de uma empresa, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              jobTitle={jobTitles[app.job_id] ?? 'Vaga encerrada'}
              companyName={companyNames[app.company_id] ?? null}
              events={eventsByApp[app.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CandidateApplications;
