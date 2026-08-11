import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'default' | 'lg';

const sizeClasses: Record<Size, string> = {
  sm: 'pl-5 pr-2.5 py-2 text-[13px]',
  default: 'pl-6 pr-3 py-3 text-[15px]',
  lg: 'pl-7 pr-3 py-3.5 text-[16px]',
};

const iconSize: Record<Size, string> = {
  sm: 'h-7 w-7',
  default: 'h-8 w-8',
  lg: 'h-9 w-9',
};

const baseClasses =
  'holo-gradient rounded-full inline-flex items-center gap-2 text-white font-semibold hover:opacity-95 transition-opacity shadow-lg shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed';

export function BrandCtaLink({
  to,
  children,
  className,
  size = 'default',
}: {
  to: string;
  children: ReactNode;
  className?: string;
  size?: Size;
}) {
  return (
    <Link to={to} className={cn(baseClasses, sizeClasses[size], className)}>
      {children}
      <span
        className={cn('rounded-full bg-white/20 flex items-center justify-center', iconSize[size])}
      >
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </Link>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: Size;
};

export function BrandCtaButton({ children, className, size = 'default', ...props }: ButtonProps) {
  return (
    <button {...props} className={cn(baseClasses, sizeClasses[size], className)}>
      {children}
      <span
        className={cn('rounded-full bg-white/20 flex items-center justify-center', iconSize[size])}
      >
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </button>
  );
}
