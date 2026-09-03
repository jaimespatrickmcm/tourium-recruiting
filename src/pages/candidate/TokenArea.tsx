// Área do candidato por token (sem OAuth). Shell com abas:
// Candidaturas / Perfil. Os dados vêm da edge function
// candidate-portal (service role), não da RLS. Mobile-first.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useCandidateToken,
  type CandidateApplication,
  type CandidateProfile,
} from '@/hooks/use-candidate-token';
import { parseCvFeedback, type CvFeedback } from '@/lib/evidence-points';
import { AccessForm } from '@/pages/candidate/Access';

type TabKey = 'candidaturas' | 'perfil';

const STAGES = [
  { key: 'triagem', label: 'Triagem' },
  { key: 'fit_cultural', label: 'Fit cultural' },
  { key: 'entrevista', label: 'Entrevista' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'contratado', label: 'Contratado' },
] as const;

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

function eventLine(e: CandidateApplication['events'][number]): string {
  const d = shortDate(e.created_at);
  if (e.to_status === 'reprovado') return `Processo encerrado em ${d}`;
  if (e.to_status === 'contratado') return `Contratado em ${d}`;
  return `Movido pra ${stageLabel(e.to_status)} em ${d}`;
}

function StageProgress({ status }: { status: string }) {
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

function ApplicationCard({ app }: { app: CandidateApplication }) {
  const [open, setOpen] = useState(false);
  const rejected = app.status === 'reprovado';
  const timelineCount = app.events.length + 1;
  const canAdvanceForm =
    !app.form_completed_at && app.companySlug && app.jobSlug && !rejected;

  return (
    <div className="bg-white rounded-card border border-line-soft p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-satoshi font-bold text-[17px] leading-snug text-ink truncate">
            {app.jobTitle}
          </h2>
          <p className="text-footnote text-ink-muted mt-0.5">
            {app.companyName ? `${app.companyName} · ` : ''}Enviada em {fullDate(app.created_at)}
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

      {canAdvanceForm && (
        <div className="mt-4 rounded-tile bg-sky-50 border border-sky-100 px-4 py-3">
          <p className="text-footnote font-semibold text-sky-900">Adiante sua candidatura</p>
          <p className="text-footnote text-sky-800 mt-0.5">
            Você ainda não respondeu o formulário completo dessa vaga.
          </p>
          <Link
            to={`/careers/${app.companySlug}/${app.jobSlug}/form`}
            className="mt-2 inline-flex h-9 items-center rounded-lg bg-sky-600 px-3.5 text-footnote font-semibold text-white hover:bg-sky-700"
          >
            Responder agora
          </Link>
        </div>
      )}

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
            {app.events.map((e, i) => (
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

function CandidaturasTab({ applications }: { applications: CandidateApplication[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-satoshi text-2xl font-bold text-ink mb-1">Minhas candidaturas</h1>
        <p className="text-sm text-ink-muted">Acompanhe em que etapa você está em cada vaga.</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-card border border-line-soft p-8 text-center">
          <p className="text-sm text-ink-muted">
            Você ainda não se candidatou a nenhuma vaga. Quando se candidatar pela página de
            carreiras de uma empresa, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

// Anotações sobre o currículo. É feedback sobre o documento, não sobre a
// pessoa, e o texto é o mesmo que a empresa enxerga do outro lado.
function CvSuggestions({ feedback }: { feedback: CvFeedback }) {
  return (
    <section className="bg-white rounded-card border border-line-soft p-5 sm:p-6">
      <h2 className="font-satoshi font-bold text-[17px] text-ink">Sugestões pro seu currículo</h2>
      <p className="text-footnote text-ink-muted mt-1">
        Anotações de quem leu seu currículo nas candidaturas. São sobre o documento, pra deixar
        ele mais fácil de ler.
      </p>

      {feedback.strengths.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink mb-2">O que já está bom</p>
          <ul className="space-y-1.5">
            {feedback.strengths.map((item, i) => (
              <li key={`cv-ok-${i}`} className="flex gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
                <span className="min-w-0 text-footnote text-ink-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink mb-2">O que ajudaria quem vai te ler</p>
          <ul className="space-y-3">
            {feedback.improvements.map((item, i) => (
              <li key={`cv-ajuste-${i}`} className="rounded-tile border border-line-soft bg-canvas p-4">
                <p className="text-sm font-semibold text-ink">{item.point}</p>
                {item.why && (
                  <p className="text-footnote text-ink-muted mt-1 leading-relaxed">{item.why}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PerfilTab({
  profile,
  onSave,
}: {
  profile: CandidateProfile;
  onSave: (updates: {
    full_name?: string;
    phone?: string;
    city?: string;
    linkedin_url?: string;
    about?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [about, setAbout] = useState(profile.about ?? '');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = await onSave({
      full_name: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      linkedin_url: linkedin.trim(),
      about: about.trim(),
    });
    setSaving(false);
    if (res.ok) toast.success('Perfil salvo.');
    else toast.error(res.error ?? 'Não conseguimos salvar agora.');
  }

  const fieldClass =
    'w-full h-11 rounded-lg border border-line-soft bg-white px-3 text-callout outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

  // Só aparece quando há currículo analisado. Sem anexo ou em análise antiga o
  // parser devolve null e a seção some.
  const cvFeedback = parseCvFeedback(profile.cv_feedback);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-satoshi text-2xl font-bold text-ink mb-1">Meu perfil</h1>
        <p className="text-sm text-ink-muted">
          Esses dados ajudam as empresas a te conhecer melhor. Seu e-mail é {profile.email}.
        </p>
      </div>

      <form onSubmit={save} className="bg-white rounded-card border border-line-soft p-5 sm:p-6 space-y-4">
        <div>
          <label htmlFor="p-name" className="block text-sm font-semibold text-ink mb-1.5">
            Nome completo
          </label>
          <input
            id="p-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldClass}
            autoComplete="name"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="p-phone" className="block text-sm font-semibold text-ink mb-1.5">
              Telefone
            </label>
            <input
              id="p-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldClass}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="p-city" className="block text-sm font-semibold text-ink mb-1.5">
              Cidade
            </label>
            <input
              id="p-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={fieldClass}
              autoComplete="address-level2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="p-linkedin" className="block text-sm font-semibold text-ink mb-1.5">
            LinkedIn
          </label>
          <input
            id="p-linkedin"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className={fieldClass}
            placeholder="https://linkedin.com/in/voce"
            inputMode="url"
          />
        </div>

        <div>
          <label htmlFor="p-about" className="block text-sm font-semibold text-ink mb-1.5">
            Sobre você
          </label>
          <textarea
            id="p-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-line-soft bg-white px-3 py-2.5 text-callout leading-relaxed outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            placeholder="Um resumo rápido da sua trajetória e do que você procura."
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto h-11 rounded-lg holo-gradient px-6 text-white font-semibold text-callout transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </form>

      {cvFeedback && <CvSuggestions feedback={cvFeedback} />}
    </div>
  );
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'candidaturas', label: 'Candidaturas' },
  { key: 'perfil', label: 'Perfil' },
];

export function CandidateTokenArea() {
  const { token, clearToken, data, loading, error, refetch, updateProfile } =
    useCandidateToken();
  const [tab, setTab] = useState<TabKey>('candidaturas');

  // Sem token: mostra o formulário de acesso por e-mail.
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="text-2xl font-bold">
              Noren
            </Link>
          </div>
          <div className="bg-white rounded-card border border-line-soft shadow-md p-6 sm:p-8">
            <h1 className="text-2xl font-bold mb-2 text-ink">Sua área de candidato</h1>
            <p className="text-sm text-ink-muted mb-6">
              Informe seu e-mail pra ver suas candidaturas e seu perfil.
            </p>
            <AccessForm />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f8]">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-line-soft">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="text-lg font-bold text-ink">
              Noren
            </Link>
            <button
              type="button"
              onClick={clearToken}
              className="inline-flex items-center gap-1.5 text-footnote font-semibold text-ink-muted hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
          <nav className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3.5 py-2.5 text-callout font-semibold border-b-2 transition-colors',
                  tab === t.key
                    ? 'border-sky-500 text-ink'
                    : 'border-transparent text-ink-subtle hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {loading && !data ? (
          <p className="text-sm text-ink-muted">Carregando...</p>
        ) : error && !data ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">{error}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            >
              Tentar de novo
            </button>
          </div>
        ) : data ? (
          <>
            {tab === 'candidaturas' && <CandidaturasTab applications={data.applications} />}
            {tab === 'perfil' && <PerfilTab profile={data.profile} onSave={updateProfile} />}
          </>
        ) : (
          <p className="text-sm text-ink-muted">Carregando...</p>
        )}
      </div>
    </main>
  );
}

export default CandidateTokenArea;
