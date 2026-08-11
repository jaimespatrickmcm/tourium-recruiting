import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react';

type Variant = 'up' | 'fade' | 'scale';

type Props = {
  children: ReactNode;
  delay?: number;
  variant?: Variant;
  className?: string;
  as?: ElementType;
};

const variantStyles = (variant: Variant, inView: boolean): string => {
  if (variant === 'fade') {
    return inView ? 'opacity-100' : 'opacity-0';
  }
  if (variant === 'scale') {
    return inView ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]';
  }
  return inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6';
};

export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className = '',
  as: Tag = 'div',
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const TagAny = Tag as ElementType;
  return (
    <TagAny
      ref={ref}
      className={`transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${variantStyles(variant, inView)} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </TagAny>
  );
}

export default Reveal;
