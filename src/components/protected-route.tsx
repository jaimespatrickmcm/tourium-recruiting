import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isCandidateUser } from '@/hooks/use-auth';
import type { UserRole } from '@/types/database';

export function ProtectedRoute({
  children,
  allowedRoles,
  allowCandidate = false,
  redirectTo = '/app',
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
  allowCandidate?: boolean;
  redirectTo?: string;
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-canvas px-4 text-center text-sm text-ink-muted"
        role="status"
        aria-live="polite"
      >
        Verificando seu acesso...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sessão de candidato (LinkedIn) não pertence à área da empresa.
  if (!allowCandidate && isCandidateUser(user)) {
    return <Navigate to="/candidato/perfil" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return (
      <Navigate
        to={role ? redirectTo : '/'}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
}
