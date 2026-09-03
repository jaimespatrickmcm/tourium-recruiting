import type { ReactNode } from 'react';
import { AlertCircle, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sem data';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleDateString('pt-BR');
}

// Data de hoje no fuso do navegador, formato YYYY-MM-DD pra <input type="date">.
// toISOString() usa UTC e entre 21h e meia-noite no Brasil devolve o dia
// seguinte, então os defaults de formulário gravavam a data errada.
export function todayLocal(): string {
  return new Intl.DateTimeFormat('sv-SE').format(new Date());
}

export function formatMoney(amountMinor: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amountMinor / 100);
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface-card min-w-0 p-5 sm:p-6', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="icon-tile h-10 w-10 shrink-0" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-title-3 font-bold text-ink">{title}</h2>
            {description && <p className="mt-1 text-footnote text-ink-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-canvas px-5 py-10 text-center">
      <Inbox className="mx-auto h-6 w-6 text-ink-subtle" aria-hidden="true" />
      <p className="mt-3 text-callout font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-footnote text-ink-muted">{description}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="surface-card flex min-h-64 items-center justify-center p-8" role="status">
      <LoaderCircle className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
      <span className="ml-3 text-callout text-ink-muted">Carregando jornada...</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-card border border-critical/20 bg-critical-tint p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-critical" aria-hidden="true" />
        <div>
          <p className="text-callout font-semibold text-ink">Não foi possível carregar esta área</p>
          <p className="mt-1 text-footnote text-ink-muted">{message}</p>
          <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'positive' | 'warning' }) {
  const tones = {
    neutral: 'border-line-soft bg-surface-sunken text-ink-muted',
    brand: 'border-brand/15 bg-brand-tint text-brand-hover',
    positive: 'border-positive/15 bg-positive-tint text-positive',
    warning: 'border-warning/15 bg-warning-tint text-warning',
  };
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-caption font-semibold', tones[tone])}>{children}</span>;
}

export const selectClass =
  'flex min-h-11 w-full rounded-control border border-input bg-surface px-3 py-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-callout';

export const submitClass = 'min-h-11 cursor-pointer';
