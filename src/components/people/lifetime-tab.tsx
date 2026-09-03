import { Award, CalendarCheck, CircleDollarSign, Clock3, Target, UserRound } from 'lucide-react';
import { EmptyState, SectionCard, formatDate, formatMoney } from '@/components/people/shared';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';

const EVENT_ICON: Record<string, typeof Clock3> = {
  hired: UserRound, salary_changed: CircleDollarSign, review_closed: CalendarCheck,
  skill_unlocked: Award, development_goal_completed: Target, development_checkin: Clock3,
};

export function LifetimeTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  return <SectionCard title="Lifetime" description="A evolução profissional reunida em uma linha do tempo" icon={Clock3}>
    {model.lifetime.length === 0 ? <EmptyState title="A linha do tempo está vazia" description="Avaliações, salários, skills e marcos do PDI aparecem aqui conforme forem registrados." /> : <ol className="relative space-y-0 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-line-soft">
      {model.lifetime.map((event) => { const Icon = EVENT_ICON[event.event_type] ?? Clock3; return <li key={`${event.event_type}-${event.event_id}`} className="relative flex min-w-0 gap-4 pb-6 last:pb-0"><span className="icon-tile relative z-10 h-10 w-10 shrink-0 border border-line-soft bg-surface"><Icon className="h-4 w-4" aria-hidden="true" /></span><div className="min-w-0 flex-1 rounded-card border border-line-soft bg-canvas p-4"><div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><p className="break-words text-callout font-semibold text-ink">{event.title}</p><time className="shrink-0 text-caption text-ink-subtle" dateTime={event.occurred_at}>{formatDate(event.occurred_at)}</time></div>{event.score !== null && <p className="mt-2 text-footnote text-ink-muted">Pontuação: <strong className="text-ink">{event.score.toLocaleString('pt-BR')}</strong></p>}{event.amount_minor !== null && <p className="mt-2 text-footnote text-ink-muted">Salário: <strong className="text-ink">{formatMoney(event.amount_minor, event.currency ?? 'BRL')}</strong></p>}</div></li>; })}
    </ol>}
  </SectionCard>;
}
