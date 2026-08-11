// Hook de dados do pipeline de seleção: carrega applications + análises de
// uma vaga, mantém polling enquanto houver análise pendente e expõe um
// patch local pra updates otimistas.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ApplicationStatus, Json } from '@/types/database';

export type ApplicationAnalysis = {
  score: number | null;
  recommendation: string | null;
  reasoning: string | null;
  dimensions: Json | null;
  status: string;
  error_message: string | null;
  ran_at: string | null;
};

export type ApplicationWithAnalysis = {
  id: string;
  company_id: string;
  candidate_id: string | null;
  candidate_name: string;
  candidate_email: string;
  why_interested: string | null;
  status: ApplicationStatus;
  created_at: string;
  ai_suspected: boolean;
  form_completed_at: string | null;
  resume_path: string | null;
  linkedin_url: string | null;
  ai_analysis: ApplicationAnalysis | null;
};

const POLL_INTERVAL_MS = 5000;

export function analysisIsPending(app: ApplicationWithAnalysis): boolean {
  return !app.ai_analysis || app.ai_analysis.status === 'pending';
}

export function useApplications(jobId: string | undefined) {
  const [applications, setApplications] = useState<ApplicationWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from('applications')
      .select(
        `
        id, company_id, candidate_id, candidate_name, candidate_email, why_interested, status, created_at, ai_suspected, form_completed_at, resume_path, linkedin_url,
        ai_analysis:ai_analyses(score, recommendation, reasoning, dimensions, status, error_message, ran_at)
      `,
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = (data as any[]).map((a) => ({
        ...a,
        ai_analysis: Array.isArray(a.ai_analysis) ? (a.ai_analysis[0] ?? null) : a.ai_analysis,
      })) as ApplicationWithAnalysis[];

      // Score desc, sem score por último
      normalized.sort((a, b) => (b.ai_analysis?.score ?? -1) - (a.ai_analysis?.score ?? -1));
      setApplications(normalized);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  const hasPending = applications.some(analysisIsPending);

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void refetch(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, refetch]);

  const patchApplication = useCallback(
    (id: string, patch: Partial<ApplicationWithAnalysis>) => {
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [],
  );

  return { applications, loading, refetch, patchApplication, hasPending };
}
