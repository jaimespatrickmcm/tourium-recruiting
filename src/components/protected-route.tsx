import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isCandidateUser } from '@/hooks/use-auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sessão de candidato (LinkedIn) não pertence à área da empresa.
  if (isCandidateUser(user)) {
    return <Navigate to="/candidato/perfil" replace />;
  }

  return <>{children}</>;
}
