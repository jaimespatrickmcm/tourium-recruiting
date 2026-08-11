import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, isCandidateUser } from '@/hooks/use-auth';

export type Candidate = {
  id: string;
  email: string;
  full_name: string | null;
  picture_url: string | null;
  linkedin_url: string | null;
  linkedin_sub: string | null;
  about: string | null;
  cv_file_path: string | null;
  cv_extracted_text: string | null;
};

const FIELDS =
  'id, email, full_name, picture_url, linkedin_url, linkedin_sub, about, cv_file_path, cv_extracted_text';

export function useCandidate() {
  const { user, loading: authLoading } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidate = useCallback(async () => {
    if (!user) {
      setCandidate(null);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('candidates')
      .select(FIELDS)
      .eq('id', user.id)
      .maybeSingle<Candidate>();

    if (fetchError) {
      console.error('[useCandidate] fetch error:', fetchError);
      setError(`fetch: ${fetchError.message} (code: ${fetchError.code ?? 'n/a'})`);
      setLoading(false);
      return;
    }

    if (data) {
      setCandidate(data);
      setLoading(false);
      return;
    }

    // Sessão de empresa não deve virar candidato por acidente.
    if (!isCandidateUser(user)) {
      setCandidate(null);
      setLoading(false);
      return;
    }

    // Auto-create if missing (trigger should handle it, but fallback)
    const meta = user.user_metadata ?? {};
    const insertPayload = {
      id: user.id,
      email: user.email ?? '',
      full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
      picture_url: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
      linkedin_sub: (meta.provider_id as string) ?? null,
    };
    const { data: created, error: insertError } = await supabase
      .from('candidates')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select(FIELDS)
      .single<Candidate>();
    if (insertError) {
      console.error('[useCandidate] insert error:', insertError);
      setError(`insert: ${insertError.message} (code: ${insertError.code ?? 'n/a'})`);
      setLoading(false);
      return;
    }
    setCandidate(created ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void fetchCandidate();
  }, [authLoading, fetchCandidate]);

  async function update(patch: Partial<Omit<Candidate, 'id' | 'email'>>) {
    if (!candidate) return { error: 'No candidate loaded' };
    const { data, error } = await supabase
      .from('candidates')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq('id', candidate.id)
      .select(FIELDS)
      .single<Candidate>();
    if (error) {
      console.error('[useCandidate] update error:', error);
      return { error: error.message };
    }
    setCandidate(data);
    return {};
  }

  return { candidate, loading: authLoading || loading, error, refetch: fetchCandidate, update };
}
