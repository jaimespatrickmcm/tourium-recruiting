import { Award, CalendarCheck, CircleDollarSign, Target } from 'lucide-react';
import type { ReturnTypeOfDevelopmentHook } from '@/components/people/types';
import { EmptyState, SectionCard, StatusPill, formatDate, formatMoney } from '@/components/people/shared';

export function OverviewTab({ model }: { model: ReturnTypeOfDevelopmentHook }) {
  const latestSalary = model.salaryHistory[0];
  const unlocked = model.collaboratorSkills.filter((item) => item.status === 'unlocked').length;
  const activePlan = model.plans.find((plan) => plan.status === 'active');
  const latestReview = model.reviews[0];
  const cards = [
    { label: 'Última avaliação', value: latestReview ? formatDate(latestReview.review_date) : 'Ainda não feita', icon: CalendarCheck },
    { label: 'Skills desbloqueadas', value: String(unlocked), icon: Award },
    { label: 'Salário atual', value: latestSalary ? formatMoney(latestSalary.amount_minor, latestSalary.currency) : 'Não informado', icon: CircleDollarSign },
    { label: 'PDI', value: activePlan ? 'Em andamento' : 'Sem plano ativo', icon: Target },
  ];

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="surface-card min-w-0 p-5">
            <div className="flex items-center gap-2 text-ink-muted">
              <Icon className="h-4 w-4" aria-hidden="true" />
              <p className="text-caption font-semibold uppercase tracking-wide">{label}</p>
            </div>
            <p className="mt-3 break-words text-title-3 font-bold text-ink">{value}</p>
          </article>
        ))}
      </div>

      <SectionCard title="Próximos passos" description="O que está aberto agora" icon={Target}>
        {!activePlan && !latestReview ? (
          <EmptyState title="A jornada começa por aqui" description="Cadastre uma avaliação ou crie o primeiro plano de desenvolvimento." />
        ) : (
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {activePlan && (
              <div className="rounded-tile border border-line-soft bg-canvas p-4">
                <StatusPill tone="brand">PDI ativo</StatusPill>
                <p className="mt-3 text-callout font-semibold text-ink">{activePlan.title}</p>
                <p className="mt-1 text-footnote text-ink-muted">Meta para {formatDate(activePlan.target_date)}</p>
              </div>
            )}
            {latestReview && (
              <div className="rounded-tile border border-line-soft bg-canvas p-4">
                <StatusPill tone={latestReview.status === 'closed' ? 'positive' : 'warning'}>
                  {latestReview.status === 'closed' ? 'Concluída' : 'Em andamento'}
                </StatusPill>
                <p className="mt-3 text-callout font-semibold text-ink">{latestReview.title}</p>
                <p className="mt-1 text-footnote text-ink-muted">{formatDate(latestReview.review_date)}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
