import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Dna,
  Briefcase,
  Users,
  UserCog,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type Item = {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  matchPath: (path: string) => boolean;
  disabled?: boolean;
};

const items: Item[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/app',
    matchPath: (p) => p === '/app',
  },
  {
    key: 'empresa',
    label: 'Empresa',
    icon: Building2,
    to: '/app/empresa',
    matchPath: (p) => p.startsWith('/app/empresa'),
  },
  {
    key: 'dna',
    label: 'DNA',
    icon: Dna,
    to: '/app/dna',
    matchPath: (p) => p.startsWith('/app/dna'),
  },
  {
    key: 'jobs',
    label: 'Vagas',
    icon: Briefcase,
    to: '/app/jobs',
    matchPath: (p) => p.startsWith('/app/jobs'),
  },
  {
    key: 'candidates',
    label: 'Candidatos',
    icon: Users,
    to: '#',
    matchPath: () => false,
    disabled: true,
  },
  {
    key: 'team',
    label: 'Time',
    icon: UserCog,
    to: '/app/time',
    matchPath: (p) => p.startsWith('/app/time'),
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div
      className="fixed left-0 right-0 z-50 px-4 pointer-events-none"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-center pointer-events-auto">
        <nav
          aria-label="Navegação principal"
          className="inline-flex items-center gap-1 bg-sky-50/90 backdrop-blur-md border border-sky-200/70 rounded-full h-14 px-2 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.25)]"
        >
          <Link
            to="/app"
            className="ml-1 mr-2 font-satoshi font-bold text-[17px] tracking-[-0.4px] text-[#1d1d1f]"
          >
            Noren
          </Link>
          <div className="h-6 w-px bg-sky-200/80 mr-1" />

          {items.map((item) => {
            const Icon = item.icon;
            const active = item.matchPath(location.pathname);

            if (item.disabled) {
              return (
                <span
                  key={item.key}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[13px] font-medium text-sky-900/40 cursor-not-allowed"
                  title="Em breve"
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  <span className="hidden md:inline">{item.label}</span>
                </span>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  'inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-[#1d1d1f] hover:bg-white/60',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}

          <div className="h-6 w-px bg-sky-200/80 mx-1" />
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-[#6b6b70] hover:bg-white/60 hover:text-[#1d1d1f] transition-colors"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </button>
        </nav>
      </div>
    </div>
  );
}

export default BottomNav;
