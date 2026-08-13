// Navegacao principal da area logada.
//
// Antes: 7 itens chapados num pill unico, sem hierarquia, com rotulos ocultos
// abaixo de `md` (viravam 7 icones mudos no celular) e um item "Candidatos"
// permanentemente desabilitado apontando pra "#".
//
// Agora a nav espelha o ciclo de vida do produto:
//   operacao (Inicio, Vagas, Candidatos, Time) fica em primeiro nivel;
//   configuracao (Empresa, DNA, Perguntas) sai do caminho e vira um menu,
//   porque e trabalho de setup — visitado uma vez, nao toda hora.
// Reduz de 7 para 4 alvos primarios e libera espaco pro rotulo aparecer
// tambem no mobile.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Briefcase,
  Users,
  UserCog,
  Building2,
  Dna,
  ListChecks,
  Settings2,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  isActive: (path: string) => boolean;
};

/** Primeiro nivel: o trabalho do dia a dia. */
const PRIMARY: NavItem[] = [
  { key: 'inicio', label: 'Início', icon: Home, to: '/app', isActive: (p) => p === '/app' },
  {
    key: 'vagas',
    label: 'Vagas',
    icon: Briefcase,
    to: '/app/jobs',
    isActive: (p) => p.startsWith('/app/jobs'),
  },
  {
    key: 'candidatos',
    label: 'Candidatos',
    icon: Users,
    to: '/app/candidatos',
    isActive: (p) => p.startsWith('/app/candidatos'),
  },
  {
    key: 'time',
    label: 'Time',
    icon: UserCog,
    to: '/app/time',
    isActive: (p) => p.startsWith('/app/time'),
  },
];

/** Segundo nivel: setup. Configurado uma vez, revisitado raramente. */
const SETUP: (NavItem & { hint: string })[] = [
  {
    key: 'empresa',
    label: 'Empresa',
    icon: Building2,
    to: '/app/empresa',
    isActive: (p) => p.startsWith('/app/empresa'),
    hint: 'Identidade, descrição e site',
  },
  {
    key: 'dna',
    label: 'DNA',
    icon: Dna,
    to: '/app/dna',
    isActive: (p) => p.startsWith('/app/dna'),
    hint: 'Cultura e perfil ideal',
  },
  {
    key: 'perguntas',
    label: 'Perguntas',
    icon: ListChecks,
    to: '/app/perguntas',
    isActive: (p) => p.startsWith('/app/perguntas'),
    hint: 'Banco de perguntas das vagas',
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [setupOpen, setSetupOpen] = useState(false);
  const setupRef = useRef<HTMLDivElement>(null);

  const setupActive = SETUP.some((item) => item.isActive(location.pathname));

  // Fecha o menu ao navegar.
  useEffect(() => setSetupOpen(false), [location.pathname]);

  // Fecha em clique fora e em Escape.
  useEffect(() => {
    if (!setupOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (setupRef.current && !setupRef.current.contains(e.target as Node)) setSetupOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSetupOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [setupOpen]);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 px-4"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-center">
        <nav
          aria-label="Navegação principal"
          className="inline-flex h-14 items-center gap-0.5 rounded-full border border-line-soft bg-surface/85 px-2 shadow-e3 backdrop-blur-xl"
        >
          <Link
            to="/app"
            className="ml-1.5 mr-2.5 font-satoshi text-title-3 font-bold text-ink"
            aria-label="Noren, ir para o início"
          >
            Noren
          </Link>
          <div className="mr-1.5 h-5 w-px bg-line-soft" aria-hidden />

          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(location.pathname);
            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-footnote font-semibold',
                  'transition-colors duration-200 ease-standard',
                  active ? 'bg-ink text-white' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {/* No mobile so o item ativo mostra rotulo: mantem o alvo de
                    toque grande sem virar uma fileira de icones mudos. */}
                <span className={cn(active ? 'inline' : 'hidden', 'sm:inline')}>{item.label}</span>
              </Link>
            );
          })}

          <div className="mx-1.5 h-5 w-px bg-line-soft" aria-hidden />

          <div className="relative" ref={setupRef}>
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={setupOpen}
              aria-label="Configuração"
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-full',
                'transition-colors duration-200 ease-standard',
                setupOpen || setupActive
                  ? 'bg-ink text-white'
                  : 'text-ink-muted hover:bg-canvas hover:text-ink',
              )}
            >
              <Settings2 className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>

            {setupOpen && (
              <div
                role="menu"
                className="absolute bottom-full right-0 mb-3 w-[264px] animate-fade-in-up rounded-panel border border-line-soft bg-surface p-2 shadow-e3"
              >
                <p className="px-3 pb-2 pt-2 text-eyebrow font-bold uppercase text-ink-subtle">
                  Configuração
                </p>
                {SETUP.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(location.pathname);
                  return (
                    <Link
                      key={item.key}
                      to={item.to}
                      role="menuitem"
                      className={cn(
                        'flex items-start gap-3 rounded-card px-3 py-2.5',
                        'transition-colors duration-200 ease-standard hover:bg-canvas',
                        active && 'bg-canvas',
                      )}
                    >
                      <span className="icon-tile mt-0.5 h-8 w-8 shrink-0">
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-callout font-semibold text-ink">
                          {item.label}
                        </span>
                        <span className="block text-caption text-ink-subtle">{item.hint}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-subtle transition-colors duration-200 ease-standard hover:bg-canvas hover:text-ink"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </nav>
      </div>
    </div>
  );
}

export default BottomNav;
