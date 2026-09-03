import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/database';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function roleFromSession(session: Session | null): UserRole | null {
  if (!session?.access_token) return null;
  try {
    const payload = session.access_token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const claims = JSON.parse(atob(`${normalized}${padding}`)) as { user_role?: unknown };
    const role = claims.user_role;
    return role === 'owner' || role === 'recruiter' || role === 'viewer'
      ? role
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        role: roleFromSession(session),
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Candidatos entram via LinkedIn OAuth; usuários de empresa via OTP de email.
// O provider no app_metadata é a forma barata (sem query) de separar os dois lados.
export function isCandidateUser(user: User | null): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  const providers: string[] = Array.isArray(meta.providers)
    ? meta.providers
    : meta.provider
      ? [meta.provider]
      : [];
  return providers.includes('linkedin_oidc');
}
