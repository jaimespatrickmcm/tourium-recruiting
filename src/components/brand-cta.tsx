// CTA primario do produto.
//
// Antes: fundo em gradiente + `shadow-lg shadow-sky-500/30` (glow colorido).
// Gradiente e glow em botao sao o par que mais entrega "template generico" —
// e num app onde quase toda tela tem um CTA, o efeito multiplica. Agora o
// preenchimento e solido e o feedback e escurecimento, nao brilho.
//
// A seta continua: e assinatura de marca e comunica avanco. O que saiu foi a
// pastilha translucida em volta dela.

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'default' | 'lg';
type Variant = 'primary' | 'secondary';

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-footnote gap-1.5',
  default: 'h-11 px-5 text-callout gap-2',
  lg: 'h-12 px-6 text-body gap-2',
};

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
};

const baseClasses = [
  'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap',
  'transition-colors duration-200 ease-standard',
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
  // Anima so o icone; o botao nao muda de tamanho e nao empurra o layout.
  '[&_svg.cta-arrow]:transition-transform [&_svg.cta-arrow]:duration-200',
  'hover:[&_svg.cta-arrow]:translate-x-0.5',
].join(' ');

function Arrow() {
  return <ArrowRight className="cta-arrow h-4 w-4" strokeWidth={2.5} aria-hidden />;
}

export function BrandCtaLink({
  to,
  children,
  className,
  size = 'default',
  variant = 'primary',
  showArrow = true,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  size?: Size;
  variant?: Variant;
  showArrow?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
    >
      {children}
      {showArrow && <Arrow />}
    </Link>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: Size;
  variant?: Variant;
  showArrow?: boolean;
};

export function BrandCtaButton({
  children,
  className,
  size = 'default',
  variant = 'primary',
  showArrow = true,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
    >
      {children}
      {showArrow && <Arrow />}
    </button>
  );
}
