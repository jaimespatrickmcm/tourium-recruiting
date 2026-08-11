import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, isCandidateUser } from '@/hooks/use-auth';

export function CandidateProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/candidato/login" state={{ from: location }} replace />;
  }

  // Sessão de empresa (OTP email) não pertence ao portal do candidato.
  if (!isCandidateUser(user)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
