// Hook de dados do pipeline de seleção: carrega applications + análises de
// uma vaga, mantém polling enquanto houver análise pendente e expõe um
// patch local pra updates otimistas.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ApplicationStatus, Json } from '@/types/database';
import { buildStageTrack, type StageScore, type StageScoreRow } from '@/lib/stage-scores';

export type ApplicationAnalysis = {
  score: number | null;
  /** Versão do pipeline que gerou a análise. Menor que a atual = precisa reprocessar. */
  pipeline_version: number | null;
  reasoning: string | null;
  cv_observations: string | null;
  cv_feedback: Json | null;
  evidence_stage: string | null;
  stage_score: number | null;
  stage_verdict: string | null;
  stage_note: string | null;
  dimensions: Json | null;
  stage_dimensions: Json | null;
  strengths: Json | null;
  concerns: Json | null;
  question_scores: Json | null;
  potential_breakdown: Json | null;
  leadership_signal: Json | null;
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
  highlight_answer: string | null;
  highlight_matched: boolean | null;
  ai_analysis: ApplicationAnalysis | null;
  /**
   * Nota de cada etapa que tem evidência própria. Vem do log append-only
   * application_stage_scores, não de ai_analyses: ai_analyses guarda só a
   * análise vigente, então a nota da triagem se perderia quando o candidato
   * avançasse pro fit cultural.
   */
  stage_track: Map<ApplicationStatus, StageScore>;
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
        id, company_id, candidate_id, candidate_name, candidate_email, why_interested, status, created_at, ai_suspected, form_completed_at, resume_path, linkedin_url, highlight_answer, highlight_matched,
        ai_analysis:ai_analyses(score, pipeline_version, reasoning, cv_observations, cv_feedback, evidence_stage, stage_score, stage_verdict, stage_note, dimensions, stage_dimensions, strengths, concerns, question_scores, potential_breakdown, leadership_signal, status, error_message, ran_at)
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
      // Histórico de notas por etapa, numa consulta só pra vaga inteira. Sem
      // isso a trilha do card dependeria de uma consulta por candidato.
      const ids = normalized.map((a) => a.id);
      const byApp = new Map<string, StageScoreRow[]>();
      if (ids.length > 0) {
        const { data: history } = await supabase
          .from('application_stage_scores')
          .select('application_id, evidence_stage, stage_score, stage_verdict, created_at')
          .in('application_id', ids);
        for (const row of (history ?? []) as StageScoreRow[]) {
          const list = byApp.get(row.application_id) ?? [];
          list.push(row);
          byApp.set(row.application_id, list);
        }
      }
      for (const app of normalized) {
        app.stage_track = buildStageTrack(byApp.get(app.id) ?? [], app.ai_analysis);
      }

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
