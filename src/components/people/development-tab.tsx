import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Plus, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, SectionCard, StatusPill, formatDate, selectClass, submitClass } from '@/components/people/shared';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';
import type { DevelopmentGoalStatus } from '@/types/database';
import { useAuth } from '@/hooks/use-auth';
import { invokeEdge } from '@/lib/functions';

const GOAL_STATUS: Record<DevelopmentGoalStatus, { label: string; tone: 'neutral' | 'brand' | 'positive' | 'warning' }> = {
  not_started: { label: 'Não iniciada', tone: 'neutral' }, in_progress: { label: 'Em andamento', tone: 'brand' },
  completed: { label: 'Concluída', tone: 'positive' }, paused: { label: 'Pausada', tone: 'warning' },
};

export function DevelopmentTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  const { role } = useAuth();
  const [showPlan, setShowPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(model.plans[0]?.id ?? null);
  const selectedPlan = model.plans.find((plan) => plan.id === selectedPlanId) ?? model.plans[0] ?? null;

  async function generateWithAgent() {
    if (!model.collaborator) return;
    setGenerating(true);
    const result = await invokeEdge<{ ok: true; planId: string; skillsCreated: number; skillsLinked: number; goalsCreated: number }>(
      'generate-development-plan',
      { collaboratorId: model.collaborator.id },
    );
    setGenerating(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    await model.refetch();
    if (result.data?.planId) setSelectedPlanId(result.data.planId);
    toast.success(`Rascunho pronto: ${result.data?.skillsLinked ?? 0} skills registradas e ${result.data?.goalsCreated ?? 0} metas propostas.`);
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    try { const plan = await model.createPlan({ title: planTitle.trim(), description: planDescription.trim() || null, targetDate: targetDate || null, startsAt: new Date().toISOString().slice(0, 10), status: 'active' }); if (!plan) throw new Error('O PDI não foi retornado após a criação.'); setSelectedPlanId(plan.id); setPlanTitle(''); setPlanDescription(''); setTargetDate(''); setShowPlan(false); toast.success('PDI criado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar o PDI.'); }
  }

  return <div className="min-w-0 space-y-5">
    {role === 'owner' && <section className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-card border border-brand/30 bg-brand-tint p-5">
      <div className="min-w-0 max-w-xl">
        <p className="flex items-center gap-2 text-callout font-bold text-ink"><Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />Primeira versão pelo agente</p>
        <p className="mt-1 text-footnote text-ink-muted">O agente lê o cargo, as respostas da candidatura e a análise, registra as skills que a pessoa demonstra e propõe um PDI em rascunho. Nada vira plano ativo sem a sua revisão.</p>
      </div>
      <Button type="button" className="min-h-11 shrink-0" disabled={generating || model.mutating} onClick={() => void generateWithAgent()}>
        <Sparkles aria-hidden="true" />{generating ? 'Analisando a jornada...' : 'Gerar com o agente'}
      </Button>
    </section>}

    <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
    <SectionCard title="Planos" description="Organize cada ciclo de desenvolvimento" icon={Target} action={<Button type="button" variant="outline" className="min-h-11" onClick={() => setShowPlan((value) => !value)}><Plus aria-hidden="true" />Novo PDI</Button>}>
      {showPlan && <form onSubmit={createPlan} className="mb-5 space-y-4 rounded-card border border-line-soft bg-canvas p-4">
        <Field id="plan-title" label="Título"><Input id="plan-title" className="min-h-11" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder="PDI do segundo semestre" required /></Field>
        <Field id="plan-description" label="Objetivo"><Textarea id="plan-description" value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} placeholder="Qual mudança este plano precisa gerar?" /></Field>
        <Field id="plan-target" label="Data alvo"><Input id="plan-target" type="date" className="min-h-11" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field>
        <Button type="submit" className={submitClass} disabled={model.mutating}>{model.mutating ? 'Criando...' : 'Criar PDI'}</Button>
      </form>}
      {model.plans.length === 0 ? <EmptyState title="Nenhum PDI criado" description="Crie um plano para reunir metas, prazos e check-ins." /> : <div className="space-y-2">{model.plans.map((plan) => <button type="button" key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`min-h-11 w-full cursor-pointer rounded-tile border p-3 text-left transition-colors ${selectedPlan?.id === plan.id ? 'border-brand bg-brand-tint' : 'border-line-soft bg-surface hover:border-line'}`}><span className="flex flex-wrap items-start justify-between gap-2"><span className="min-w-0 break-words text-callout font-semibold text-ink">{plan.title}</span><StatusPill tone={plan.status === 'completed' ? 'positive' : plan.status === 'active' ? 'brand' : plan.status === 'cancelled' ? 'warning' : 'neutral'}>{plan.status === 'completed' ? 'Concluído' : plan.status === 'active' ? 'Ativo' : plan.status === 'cancelled' ? 'Descartado' : 'Rascunho'}</StatusPill></span><span className="mt-1 block text-footnote text-ink-muted">Até {formatDate(plan.target_date)}</span></button>)}</div>}
    </SectionCard>
    {selectedPlan ? <PlanDetail model={model} plan={selectedPlan} /> : <SectionCard title="Metas e check-ins"><EmptyState title="Escolha um PDI" description="As metas e a timeline de aprendizado aparecem aqui." /></SectionCard>}
    </div>
  </div>;
}

function PlanDetail({ model, plan }: { model: ReturnTypeOfDevelopmentHook; plan: ReturnTypeOfDevelopmentHook['plans'][number] }) {
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalSkill, setGoalSkill] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [checkinGoal, setCheckinGoal] = useState('');
  const [checkinProgress, setCheckinProgress] = useState('');
  const [checkinNote, setCheckinNote] = useState('');
  const goals = useMemo(() => model.goals.filter((goal) => goal.plan_id === plan.id), [model.goals, plan.id]);
  const checkins = useMemo(() => model.checkins.filter((checkin) => checkin.plan_id === plan.id), [model.checkins, plan.id]);

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    try { await model.createGoal(plan.id, { title: goalTitle.trim(), description: goalDescription.trim() || null, skillId: goalSkill || null, dueDate: goalDate || null, status: 'not_started', position: goals.length }); setGoalTitle(''); setGoalDescription(''); setGoalSkill(''); setGoalDate(''); toast.success('Meta criada.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível criar a meta.'); }
  }
  async function addCheckin(event: FormEvent) {
    event.preventDefault();
    const progress = checkinProgress === '' ? null : Math.max(0, Math.min(100, Number(checkinProgress)));
    if (progress !== null && !Number.isFinite(progress)) {
      toast.error('Informe um progresso entre 0 e 100.');
      return;
    }
    try {
      if (checkinGoal && progress !== null) await model.updateGoal(checkinGoal, { progress_percent: progress, status: progress >= 100 ? 'completed' : 'in_progress', completed_at: progress >= 100 ? new Date().toISOString() : null });
      await model.addCheckin(plan.id, { goalId: checkinGoal || null, progressPercent: progress, note: checkinNote.trim() || null });
      setCheckinProgress(''); setCheckinNote(''); toast.success('Check-in registrado.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o check-in.'); }
  }
  async function completeGoal(goalId: string) {
    try { await model.updateGoal(goalId, { status: 'completed', progress_percent: 100, completed_at: new Date().toISOString() }); toast.success('Meta concluída.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a meta.'); }
  }
  async function activatePlan() {
    try { await model.updatePlan(plan.id, { status: 'active', starts_at: new Date().toISOString().slice(0, 10) }); toast.success('PDI ativado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível ativar o PDI.'); }
  }
  async function discardPlan() {
    try { await model.updatePlan(plan.id, { status: 'cancelled' }); toast.success('Rascunho descartado.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível descartar o rascunho.'); }
  }

  return <div className="min-w-0 space-y-5">
    {plan.status === 'draft' && <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-line-soft bg-canvas p-4">
      <p className="min-w-0 max-w-xl text-footnote text-ink-muted"><strong className="text-ink">Este PDI é um rascunho.</strong> Revise as metas, ajuste o que precisar e ative quando fizer sentido.</p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" className="min-h-11" disabled={model.mutating} onClick={() => void activatePlan()}><CheckCircle2 aria-hidden="true" />Ativar PDI</Button>
        <Button type="button" variant="ghost" className="min-h-11" disabled={model.mutating} onClick={() => void discardPlan()}>Descartar</Button>
      </div>
    </div>}
    <SectionCard title={plan.title} description={plan.description ?? 'Plano de desenvolvimento individual'} icon={Target}>
      <form onSubmit={createGoal} className="grid min-w-0 gap-4 rounded-card border border-line-soft bg-canvas p-4 sm:grid-cols-2">
        <Field id={`goal-title-${plan.id}`} label="Nova meta" className="sm:col-span-2"><Input id={`goal-title-${plan.id}`} className="min-h-11" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Ex.: Conduzir uma apresentação mensal" required /></Field>
        <Field id={`goal-skill-${plan.id}`} label="Skill ligada"><select id={`goal-skill-${plan.id}`} className={selectClass} value={goalSkill} onChange={(event) => setGoalSkill(event.target.value)}><option value="">Sem skill</option>{model.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>
        <Field id={`goal-date-${plan.id}`} label="Prazo"><Input id={`goal-date-${plan.id}`} type="date" className="min-h-11" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} /></Field>
        <Field id={`goal-description-${plan.id}`} label="Critério de sucesso" className="sm:col-span-2"><Textarea id={`goal-description-${plan.id}`} value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} placeholder="Como vamos saber que a meta foi cumprida?" /></Field>
        <div className="sm:col-span-2"><Button type="submit" className={submitClass} disabled={model.mutating}><Plus aria-hidden="true" />Adicionar meta</Button></div>
      </form>
      {goals.length === 0 ? <div className="mt-5"><EmptyState title="Nenhuma meta neste plano" description="Adicione uma meta clara, com prazo e skill relacionada." /></div> : <div className="mt-5 space-y-3">{goals.map((goal) => <article key={goal.id} className="rounded-card border border-line-soft bg-surface p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-callout font-bold text-ink">{goal.title}</p><p className="mt-1 text-footnote text-ink-muted">Prazo: {formatDate(goal.due_date)}</p></div><StatusPill tone={GOAL_STATUS[goal.status].tone}>{GOAL_STATUS[goal.status].label}</StatusPill></div>{goal.description && <p className="mt-3 break-words text-footnote text-ink-muted">{goal.description}</p>}<div className="mt-4" aria-label={`Progresso de ${goal.progress_percent}%`}><div className="mb-2 flex justify-between text-caption text-ink-muted"><span>Progresso</span><span>{goal.progress_percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${goal.progress_percent}%` }} /></div></div>{goal.status !== 'completed' && <Button type="button" variant="ghost" className="mt-3 min-h-11" disabled={model.mutating} onClick={() => void completeGoal(goal.id)}><CheckCircle2 aria-hidden="true" />Marcar como concluída</Button>}</article>)}</div>}
    </SectionCard>

    <SectionCard title="Check-in" description="Registre o avanço e o que mudou desde a última conversa" icon={CalendarDays}>
      <form onSubmit={addCheckin} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field id={`checkin-goal-${plan.id}`} label="Meta"><select id={`checkin-goal-${plan.id}`} className={selectClass} value={checkinGoal} onChange={(event) => setCheckinGoal(event.target.value)}><option value="">Check-in geral do plano</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field>
        <Field id={`checkin-progress-${plan.id}`} label="Progresso em %"><Input id={`checkin-progress-${plan.id}`} type="number" min={0} max={100} className="min-h-11" value={checkinProgress} onChange={(event) => setCheckinProgress(event.target.value)} placeholder="Ex.: 60" /></Field>
        <Field id={`checkin-note-${plan.id}`} label="O que avançou?" className="sm:col-span-2"><Textarea id={`checkin-note-${plan.id}`} value={checkinNote} onChange={(event) => setCheckinNote(event.target.value)} placeholder="Registre o aprendizado, o bloqueio ou a próxima ação" /></Field>
        <div className="sm:col-span-2"><Button type="submit" className={submitClass} disabled={model.mutating}>{model.mutating ? 'Registrando...' : 'Registrar check-in'}</Button></div>
      </form>
      {checkins.length > 0 && <ol className="mt-6 space-y-3 border-t border-line-soft pt-5">{checkins.map((checkin) => <li key={checkin.id} className="rounded-tile bg-canvas p-4"><div className="flex flex-wrap items-center justify-between gap-2"><time className="text-footnote font-semibold text-ink" dateTime={checkin.occurred_at}>{formatDate(checkin.occurred_at)}</time>{checkin.progress_percent !== null && <StatusPill tone="brand">{checkin.progress_percent}%</StatusPill>}</div>{checkin.note && <p className="mt-2 break-words text-footnote text-ink-muted">{checkin.note}</p>}</li>)}</ol>}
    </SectionCard>
  </div>;
}

function Field({ id, label, children, className }: { id: string; label: string; children: React.ReactNode; className?: string }) { return <div className={`min-w-0 ${className ?? ''}`}><Label htmlFor={id} className="mb-2 block text-footnote font-semibold text-ink">{label}</Label>{children}</div>; }
