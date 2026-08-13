import type { Config } from 'tailwindcss';

/**
 * Escalas do design system do Noren.
 *
 * As paginas consomem so nomes semanticos. Se voce esta prestes a escrever
 * `text-[15px]`, `rounded-[24px]`, `shadow-[0_10px_40px...]` ou um hex direto
 * na classe, para: o token ja existe aqui ou precisa nascer aqui.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // --- Semantico do Noren ---
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          muted: 'hsl(var(--ink-muted))',
          subtle: 'hsl(var(--ink-subtle))',
        },
        canvas: 'hsl(var(--canvas))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          sunken: 'hsl(var(--surface-sunken))',
        },
        line: {
          DEFAULT: 'hsl(var(--line))',
          soft: 'hsl(var(--line-soft))',
        },
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          hover: 'hsl(var(--brand-hover))',
          tint: 'hsl(var(--brand-tint))',
        },
        positive: {
          DEFAULT: 'hsl(var(--positive))',
          tint: 'hsl(var(--positive-tint))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          tint: 'hsl(var(--warning-tint))',
        },
        critical: {
          DEFAULT: 'hsl(var(--critical))',
          tint: 'hsl(var(--critical-tint))',
        },

        // --- Bridge shadcn (ui/* depende destes nomes) ---
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },

      /**
       * Escala de raio. Substitui os avulsos 10/24/28/40px que estavam
       * espalhados. Nomes por funcao, nao por tamanho.
       */
      borderRadius: {
        control: '0.625rem', // 10px — input, botao pequeno
        tile: '0.875rem', //    14px — chip de icone, avatar quadrado
        card: '1.25rem', //     20px — card padrao
        panel: '1.75rem', //    28px — painel grande, modal, hero
        // Bridge shadcn
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 6px)',
        sm: 'calc(var(--radius) - 10px)',
      },

      /**
       * Elevacao em 3 degraus. Antes eram 9 sombras improvisadas — a maior
       * causa do visual "template". Regra: e1 e o default de superficie
       * flutuante leve; e2 e overlay ancorado; e3 e so pra modal e nav.
       */
      boxShadow: {
        e1: '0 1px 2px 0 hsl(240 6% 10% / 0.04)',
        e2: '0 4px 16px -4px hsl(240 6% 10% / 0.08)',
        e3: '0 24px 60px -20px hsl(240 6% 10% / 0.18)',
        none: 'none',
      },

      /**
       * Escala tipografica. Antes: [44px] [36px] [26px] [22px] [18px] [17px]
       * [16px] [15px] [14px] [13px] [12px] [11px] [9px] — treze tamanhos
       * arbitrarios. Agora: nove degraus com tracking e leading ja embutidos.
       */
      fontSize: {
        display: ['2.75rem', { lineHeight: '1.06', letterSpacing: '-0.045em' }], // 44
        'title-1': ['2.125rem', { lineHeight: '1.12', letterSpacing: '-0.035em' }], // 34
        'title-2': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.025em' }], // 24
        'title-3': ['1.1875rem', { lineHeight: '1.3', letterSpacing: '-0.018em' }], // 19
        body: ['1rem', { lineHeight: '1.6', letterSpacing: '-0.011em' }], // 16
        callout: ['0.9375rem', { lineHeight: '1.55', letterSpacing: '-0.008em' }], // 15
        footnote: ['0.8125rem', { lineHeight: '1.45', letterSpacing: '0' }], // 13
        caption: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.005em' }], // 12
        eyebrow: ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.08em' }], // 11
      },

      fontFamily: {
        sans: ['Satoshi', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        satoshi: ['Satoshi', 'system-ui', 'sans-serif'],
      },

      transitionTimingFunction: {
        // Curva padrao de UI. Usar em tudo que nao seja spring.
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.35s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
