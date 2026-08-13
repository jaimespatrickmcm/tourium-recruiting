// Acesso do candidato por token (sem OAuth). O token mora no localStorage e a
// área é servida pela edge function candidate-portal usando service role. Nada
// de sessão do Supabase Auth aqui.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';

const TOKEN_KEY = 'noren_candidate_token';

export type CandidateProfile = {
  email: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  linkedin_url: string | null;
  picture_url: string | null;
  about: string | null;
  // Anotações sobre o currículo, vindas da última análise do candidato.
  // Opcional de propósito: hoje a edge function candidate-portal ainda não
  // devolve esse campo, então ele chega undefined e a seção não renderiza.
  // Pra ligar, o portal precisa incluir ai_analyses.cv_feedback no payload.
  cv_feedback?: Json | null;
};

export type CandidateApplication = {
  id: string;
  status: string;
  created_at: string;
  form_completed_at: string | null;
  jobTitle: string;
  companyName: string | null;
  companySlug: string | null;
  jobSlug: string | null;
  events: Array<{
    from_status: string | null;
    to_status: string | null;
    created_at: string;
  }>;
};

export type CandidateScore = { area: string; score: number; recorded_at: string };

export type CandidateGoal = {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  status: 'em_andamento' | 'concluida' | 'pausada';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CandidateJornada = {
  collaborator: {
    id: string;
    company_id: string;
    full_name: string;
    role_title: string | null;
    hired_at: string;
    status: 'ativo' | 'desligado';
    company_name: string | null;
  };
  scores: CandidateScore[];
  goals: CandidateGoal[];
};

export type CandidatePortalData = {
  profile: CandidateProfile;
  applications: CandidateApplication[];
  jornada: CandidateJornada | null;
};

export type ProfileUpdate = {
  full_name?: string;
  phone?: string;
  city?: string;
  linkedin_url?: string;
  about?: string;
};

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function useCandidateToken() {
  const [token, setTokenState] = useState<string | null>(() => readToken());
  const [data, setData] = useState<CandidatePortalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setToken = useCallback((next: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, next);
    } catch {
      // ignore storage errors
    }
    setTokenState(next);
  }, []);

  const clearToken = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
    setTokenState(null);
    setData(null);
    setError(null);
  }, []);

  const refetch = useCallback(async () => {
    const current = readToken();
    if (!current) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke('candidate-portal', {
        body: { token: current, action: 'get' },
      });
      if (fnError) throw fnError;
      if (!res?.ok) {
        // Token inválido ou expirado: limpa pra cair de volta no acesso.
        if (res?.error) {
          setError(res.error as string);
        }
        setData(null);
        setLoading(false);
        return;
      }
      setData({
        profile: res.profile as CandidateProfile,
        applications: (res.applications ?? []) as CandidateApplication[],
        jornada: (res.jornada ?? null) as CandidateJornada | null,
      });
    } catch {
      setError('Não conseguimos carregar sua área agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdate) => {
      const current = readToken();
      if (!current) return { ok: false, error: 'Sem acesso ativo' };
      const { data: res, error: fnError } = await supabase.functions.invoke('candidate-portal', {
        body: { token: current, action: 'update_profile', payload: updates },
      });
      if (fnError || !res?.ok) {
        return { ok: false, error: (res?.error as string) ?? 'Não conseguimos salvar agora.' };
      }
      await refetch();
      return { ok: true };
    },
    [refetch],
  );

  useEffect(() => {
    if (token) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { token, setToken, clearToken, data, loading, error, refetch, updateProfile };
}

export default useCandidateToken;
