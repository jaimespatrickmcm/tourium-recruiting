import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/candidato/candidaturas', label: 'Candidaturas' },
  { to: '/candidato/jornada', label: 'Jornada' },
  { to: '/candidato/perfil', label: 'Perfil' },
];

export function CandidateLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/candidato/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/candidato" className="text-lg font-bold">
            Noren · Candidato
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 sm:px-6 -mb-px" aria-label="Navegação do candidato">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                    isActive
                      ? 'border-sky-600 text-[#1d1d1f]'
                      : 'border-transparent text-[#6b6b70] hover:text-[#1d1d1f]',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default CandidateLayout;
