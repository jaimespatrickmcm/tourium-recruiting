import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Target, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { BrandCtaButton } from '@/components/brand-cta';
import { ScoutCard } from '@/components/scout-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { SCOUT_AREAS, areaLabel, type ScoutAreaKey } from '@/lib/scout-areas';
import {
  groupScoreBatches,
  latestScoreByArea,
  overallFromLatest,
  formatDatePtBR,
  formatShortDatePtBR,
  type Collaborator,
  type CollaboratorScore,
  type DevelopmentGoal,
  type ScoreBatch,
} from '@/hooks/use-collaborators';
import { cn } from '@/lib/utils';
import type { GoalStatus } from '@/types/database';

export function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [scores, setScores] = useState<CollaboratorScore[]>([]);
  const [goals, setGoals] = useState<DevelopmentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [collabRes, scoresRes, goalsRes] = await Promise.all([
      supabase.from('collaborators').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('collaborator_scores')
        .select('*')
        .eq('collaborator_id', id)
        .order('recorded_at', { ascending: true }),
      supabase
        .from('development_goals')
        .select('*')
        .eq('collaborator_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (collabRes.error) {
      console.error('[TeamDetail] fetch error:', collabRes.error);
      toast.error('Erro ao carregar colaborador.');
      setLoading(false);
      return;
    }
    if (!collabRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCollaborator(collabRes.data);
    setScores(scoresRes.data ?? []);
    setGoals(goalsRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8 text-ink-subtle text-sm">Carregando...</div>
    );
  }

  if (notFound || !collaborator) {
    return (
      <div className="min-h-screen bg-white p-8">
        <p className="text-ink-muted mb-4">Colaborador não encontrado.</p>
        <Link to="/app/time" className="text-sky-600 text-callout hover:underline">
          Voltar pro time
        </Link>
      </div>
    );
  }

  const latest = latestScoreByArea(scores);
  const dimensions = SCOUT_AREAS.filter((a) => latest.has(a.key)).map((a) => ({
    area: a.key,
    score: latest.get(a.key)!,
  }));
  const overall = overallFromLatest(latest) ?? 0;
  const batches = groupScoreBatches(scores);
  const history = batches.map((b) => ({
    label: formatShortDatePtBR(b.recordedAt),
    overall: b.overall,
  }));

  async function toggleStatus() {
    if (!collaborator) return;
    const desligar = collaborator.status === 'ativo';
    const ok = window.confirm(
      desligar
        ? `Desligar ${collaborator.full_name}? A pessoa sai da lista de ativos, mas todo o histórico continua salvo.`
        : `Reativar ${collaborator.full_name}? A pessoa volta pra lista de ativos.`,
    );
    if (!ok) return;
    const { error } = await supabase
      .from('collaborators')
      .update({ status: desligar ? 'desligado' : 'ativo' })
      .eq('id', collaborator.id);
    if (error) {
      toast.error(error.message ?? 'Erro ao atualizar status');
      return;
    }
    toast.success(desligar ? 'Colaborador desligado.' : 'Colaborador reativado.');
    void load();
  }

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.05),transparent_70%)]" />

      <div className="relative max-w-5xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link
              to="/app/time"
              className="inline-flex items-center gap-1.5 text-footnote font-medium text-ink-subtle hover:text-ink transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Time
            </Link>
            <h1 className="font-satoshi font-bold text-[32px] md:text-[40px] tracking-[-0.7px] leading-[1.1] text-ink">
              {collaborator.full_name}
            </h1>
            <p className="text-callout text-ink-muted mt-2">
              {collaborator.role_title ? `${collaborator.role_title} · ` : ''}
              desde {formatDatePtBR(collaborator.hired_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleStatus()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-line-soft bg-white text-footnote font-semibold text-ink hover:border-line transition-colors whitespace-nowrap"
          >
            {collaborator.status === 'ativo' ? (
              <>
                <UserMinus className="h-3.5 w-3.5" />
                Desligar
              </>
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                Reativar
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
          {/* Coluna esquerda: scout card */}
          <div className="lg:sticky lg:top-8">
            {dimensions.length > 0 ? (
              <ScoutCard
                name={collaborator.full_name}
                subtitle={collaborator.role_title}
                overall={overall}
                dimensions={dimensions}
                history={history}
                badge={collaborator.status === 'desligado' ? 'Desligado' : null}
              />
            ) : (
              <div className="rounded-card border border-line-soft bg-white p-8 text-center">
                <p className="text-callout font-semibold text-ink mb-1">
                  Sem avaliações ainda
                </p>
                <p className="text-footnote text-ink-muted leading-relaxed">
                  Registra a primeira avaliação ao lado e o scout card aparece aqui.
                </p>
              </div>
            )}
          </div>

          {/* Coluna direita: avaliação, metas, timeline */}
          <div className="space-y-8">
            <AssessmentSection collaborator={collaborator} latest={latest} onSaved={load} />
            <GoalsSection collaborator={collaborator} goals={goals} onChanged={load} />
            <TimelineSection collaborator={collaborator} batches={batches} goals={goals} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Registrar avaliação ──────────────────────────────────────────────────────

function AssessmentSection({
  collaborator,
  latest,
  onSaved,
}: {
  collaborator: Collaborator;
  latest: Map<string, number>;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<Record<ScoutAreaKey, string>>(() => buildInitial(latest));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-prefill quando os últimos scores mudam (ex.: depois de salvar).
  useEffect(() => {
    setValues(buildInitial(latest));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify([...latest.entries()])]);

  function buildInitial(map: Map<string, number>): Record<ScoutAreaKey, string> {
    const initial = {} as Record<ScoutAreaKey, string>;
    for (const a of SCOUT_AREAS) {
      initial[a.key] = map.has(a.key) ? String(map.get(a.key)) : '';
    }
    return initial;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = {} as Record<ScoutAreaKey, number>;
    for (const a of SCOUT_AREAS) {
      const raw = values[a.key].trim();
      const n = Number(raw);
      if (raw === '' || Number.isNaN(n) || n < 0 || n > 100) {
        toast.error(`O score de ${a.label} precisa estar entre 0 e 100.`);
        return;
      }
      parsed[a.key] = Math.round(n);
    }
    setSaving(true);
    const recordedAt = new Date().toISOString();
    const trimmedNote = note.trim() || null;
    const rows = SCOUT_AREAS.map((a) => ({
      collaborator_id: collaborator.id,
      company_id: collaborator.company_id,
      area: a.key,
      score: parsed[a.key],
      note: trimmedNote,
      source: 'avaliacao' as const,
      recorded_at: recordedAt,
    }));
    const { error } = await supabase.from('collaborator_scores').insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? 'Erro ao registrar avaliação');
      return;
    }
    toast.success('Avaliação registrada.');
    setNote('');
    await onSaved();
  }

  return (
    <section className="rounded-card border border-line-soft bg-white p-6">
      <h2 className="font-satoshi font-bold text-[18px] tracking-[-0.3px] text-ink mb-1">
        Registrar avaliação
      </h2>
      <p className="text-footnote text-ink-muted mb-5">
        Dá uma nota de 0 a 100 por área. Cada avaliação vira um ponto na evolução do scout card.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {SCOUT_AREAS.map((a) => (
          <div key={a.key} className="flex items-center gap-3">
            <Label
              htmlFor={`score-${a.key}`}
              className="w-28 shrink-0 text-footnote font-medium text-ink-muted"
            >
              {a.label}
            </Label>
            <Input
              id={`score-${a.key}`}
              type="number"
              min={0}
              max={100}
              value={values[a.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [a.key]: e.target.value }))}
              className="max-w-[110px]"
              required
            />
          </div>
        ))}
        <div className="pt-2 space-y-1.5">
          <Label htmlFor="assessment-note" className="text-footnote font-medium text-ink-muted">
            Nota (opcional)
          </Label>
          <Textarea
            id="assessment-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contexto da avaliação, destaques, pontos de atenção..."
            rows={3}
          />
        </div>
        <div className="pt-2">
          <BrandCtaButton type="submit" size="sm" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar avaliação'}
          </BrandCtaButton>
        </div>
      </form>
    </section>
  );
}

// ── Plano de desenvolvimento ─────────────────────────────────────────────────

const GOAL_STATUS_STYLE: Record<GoalStatus, { label: string; className: string }> = {
  em_andamento: {
    label: 'Em andamento',
    className: 'bg-sky-50 border-sky-100 text-sky-800',
  },
  concluida: {
    label: 'Concluída',
    className: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  },
  pausada: {
    label: 'Pausada',
    className: 'bg-amber-50 border-amber-100 text-amber-700',
  },
};

function GoalsSection({
  collaborator,
  goals,
  onChanged,
}: {
  collaborator: Collaborator;
  goals: DevelopmentGoal[];
  onChanged: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('A meta precisa de um título.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('development_goals').insert({
      collaborator_id: collaborator.id,
      company_id: collaborator.company_id,
      title: title.trim(),
      area: area || null,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? 'Erro ao criar meta');
      return;
    }
    toast.success('Meta criada.');
    setTitle('');
    setArea('');
    setDueDate('');
    setShowForm(false);
    await onChanged();
  }

  async function updateGoal(goal: DevelopmentGoal, patch: { status: GoalStatus; completed_at?: string | null }, message: string) {
    const { error } = await supabase.from('development_goals').update(patch).eq('id', goal.id);
    if (error) {
      toast.error(error.message ?? 'Erro ao atualizar meta');
      return;
    }
    toast.success(message);
    await onChanged();
  }

  return (
    <section className="rounded-card border border-line-soft bg-white p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-satoshi font-bold text-[18px] tracking-[-0.3px] text-ink">
          Plano de desenvolvimento
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line-soft bg-white text-caption font-semibold text-ink hover:border-line transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova meta
        </button>
      </div>
      <p className="text-footnote text-ink-muted mb-5">
        Metas de evolução ligadas às áreas do scout card.
      </p>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-5 rounded-card border border-line-soft bg-canvas p-4 space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="goal-title" className="text-footnote font-semibold text-ink">
              Título
            </Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Liderar o onboarding do próximo contratado"
              required
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="goal-area" className="text-footnote font-semibold text-ink">
                Área (opcional)
              </Label>
              <select
                id="goal-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sem área</option>
                {SCOUT_AREAS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="goal-due" className="text-footnote font-semibold text-ink">
                Prazo (opcional)
              </Label>
              <Input
                id="goal-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="pt-1">
            <BrandCtaButton type="submit" size="sm" disabled={saving}>
              {saving ? 'Criando...' : 'Criar meta'}
            </BrandCtaButton>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-soft p-8 text-center">
          <div className="inline-flex h-10 w-10 rounded-tile bg-surface-sunken items-center justify-center mb-3">
            <Target className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
          </div>
          <p className="text-callout text-ink-muted">
            Nenhuma meta ainda. Cria a primeira pra dar direção ao desenvolvimento.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const style = GOAL_STATUS_STYLE[goal.status];
            return (
              <div key={goal.id} className="rounded-card border border-line-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-callout font-semibold text-ink">{goal.title}</p>
                    {goal.description && (
                      <p className="text-footnote text-ink-muted mt-0.5">{goal.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-eyebrow font-bold uppercase',
                          style.className,
                        )}
                      >
                        {style.label}
                      </span>
                      {goal.area && (
                        <span className="inline-flex items-center rounded-full bg-surface-sunken border border-line-soft px-2.5 py-0.5 text-caption font-semibold text-ink-muted">
                          {areaLabel(goal.area)}
                        </span>
                      )}
                      {goal.due_date && (
                        <span className="text-caption text-ink-subtle">
                          prazo {formatDatePtBR(goal.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {goal.status === 'em_andamento' && (
                    <>
                      <GoalAction
                        label="Concluir"
                        onClick={() =>
                          void updateGoal(
                            goal,
                            { status: 'concluida', completed_at: new Date().toISOString() },
                            'Meta concluída.',
                          )
                        }
                      />
                      <GoalAction
                        label="Pausar"
                        onClick={() =>
                          void updateGoal(goal, { status: 'pausada' }, 'Meta pausada.')
                        }
                      />
                    </>
                  )}
                  {goal.status === 'pausada' && (
                    <GoalAction
                      label="Reativar"
                      onClick={() =>
                        void updateGoal(goal, { status: 'em_andamento' }, 'Meta reativada.')
                      }
                    />
                  )}
                  {goal.status === 'concluida' && (
                    <GoalAction
                      label="Reativar"
                      onClick={() =>
                        void updateGoal(
                          goal,
                          { status: 'em_andamento', completed_at: null },
                          'Meta reativada.',
                        )
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GoalAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-caption font-semibold text-sky-700 hover:text-sky-900 transition-colors"
    >
      {label}
    </button>
  );
}

// ── Linha do tempo ───────────────────────────────────────────────────────────

type TimelineEvent = { key: string; date: string; title: string; detail: string | null };

function TimelineSection({
  collaborator,
  batches,
  goals,
}: {
  collaborator: Collaborator;
  batches: ScoreBatch[];
  goals: DevelopmentGoal[];
}) {
  const events: TimelineEvent[] = [
    {
      key: 'hired',
      date: collaborator.hired_at,
      title: 'Contratação',
      detail: collaborator.application_id ? null : 'Adicionado manualmente',
    },
    ...batches.map((b, i) => ({
      key: `batch-${i}`,
      date: b.recordedAt,
      title:
        b.source === 'analise_inicial'
          ? `Análise inicial, geral ${b.overall}`
          : `Avaliação registrada, geral ${b.overall}`,
      detail: null,
    })),
    ...goals.map((g) => ({
      key: `goal-created-${g.id}`,
      date: g.created_at,
      title: `Meta criada: ${g.title}`,
      detail: null,
    })),
    ...goals
      .filter((g) => g.completed_at)
      .map((g) => ({
        key: `goal-done-${g.id}`,
        date: g.completed_at!,
        title: `Meta concluída: ${g.title}`,
        detail: null,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="rounded-card border border-line-soft bg-white p-6">
      <h2 className="font-satoshi font-bold text-[18px] tracking-[-0.3px] text-ink mb-5">
        Linha do tempo
      </h2>
      <div>
        {events.map((event, i) => (
          <div key={event.key} className="relative pl-7 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span className="absolute left-[5px] top-4 bottom-0 w-px bg-gray-200" />
            )}
            <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full holo-gradient" />
            <p className="text-callout font-medium text-ink leading-snug">{event.title}</p>
            {event.detail && <p className="text-caption text-ink-muted mt-0.5">{event.detail}</p>}
            <p className="text-caption text-ink-subtle mt-0.5">{formatDatePtBR(event.date)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TeamDetail;
