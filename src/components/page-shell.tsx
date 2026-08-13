// Casca padrao das telas internas.
//
// Existia como copy-paste em cada pagina: o mesmo `relative min-h-screen`, o
// mesmo radial-gradient escrito na mao, o mesmo bloco eyebrow + h1 + subtitulo
// com hex e tamanhos avulsos. Centralizar aqui garante que ritmo vertical,
// largura de coluna e tipografia sejam identicos em toda a area logada.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Width = 'narrow' | 'default' | 'wide';

const widthClasses: Record<Width, string> = {
  narrow: 'max-w-2xl', //  leitura densa: formulario, detalhe
  default: 'max-w-4xl', // padrao: dashboard, empresa
  wide: 'max-w-6xl', //    grade: vagas, candidatos, time
};

export function PageShell({
  eyebrow,
  title,
  description,
  action,
  width = 'default',
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** CTA primario da tela. Fica alinhado ao topo do titulo no desktop. */
  action?: ReactNode;
  width?: Width;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="canvas-tint pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <div className={cn('relative mx-auto px-5 py-10 sm:px-8 sm:py-14', widthClasses[width])}>
        <header className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-3 text-eyebrow font-bold uppercase text-ink-subtle">{eyebrow}</p>
            <h1 className="font-satoshi text-title-1 font-bold text-ink sm:text-display">
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-xl text-body text-ink-muted">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>

        {children}
      </div>
    </div>
  );
}

/**
 * Estado vazio padrao. Antes cada tela inventava o seu, e o resultado era que
 * "Time" parecia quebrado em vez de vazio: sem acao visivel, sem explicar o
 * que preenche aquilo. Todo empty state agora responde as tres perguntas:
 * o que e isso, por que esta vazio, o que eu faco agora.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Linha de apoio: o caminho automatico, quando existe um. */
  hint?: string;
}) {
  return (
    <div className="surface-card px-6 py-14 text-center sm:px-12">
      <div className="icon-tile mx-auto mb-5 h-14 w-14">{icon}</div>
      <h2 className="mb-2 font-satoshi text-title-2 font-bold text-ink">{title}</h2>
      <p className="mx-auto mb-7 max-w-md text-callout text-ink-muted">{description}</p>
      {action}
      {hint && <p className="mt-5 text-footnote text-ink-subtle">{hint}</p>}
    </div>
  );
}

export default PageShell;
