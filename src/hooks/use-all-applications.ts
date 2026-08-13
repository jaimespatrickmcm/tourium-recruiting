// Candidatos de todas as vagas da empresa.
//
// `use-applications` carrega o pipeline de UMA vaga e alimenta o JobDetail.
// Este aqui atende a pergunta que o recrutador faz antes de escolher a vaga:
// "quem entrou, em que pe esta, e o que a analise disse". RLS ja limita por
// company_id, entao nao ha filtro de tenant no client.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ApplicationStatus } from '@/types/database';

export type CandidateRow = {
  id: string;
  job_id: string;
  job_title: string;
  candidate_name: string;
  candidate_email: string;
  status: ApplicationStatus;
  created_at: string;
  ai_suspected: boolean;
  form_completed_at: string | null;
  score: number | null;
  stage_score: number | null;
  stage_verdict: string | null;
  analysis_status: string | null;
};

export const STAGES = [
  { value: 'triagem', label: 'Triagem' },
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'contratado', label: 'Contratado' },
  { value: 'reprovado', label: 'Reprovado' },
] as const;

export type StageValue = (typeof STAGES)[number]['value'];

const POLL_INTERVAL_MS = 8000;

export function useAllApplications() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('applications')
      .select(
        `
        id, job_id, candidate_name, candidate_email, status, created_at, ai_suspected, form_completed_at,
        job:jobs(title),
        ai_analysis:ai_analyses(score, stage_score, stage_verdict, status)
      `,
      )
      .order('created_at', { ascending: false });

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = (data as any[]).map((a): CandidateRow => {
        const analysis = Array.isArray(a.ai_analysis) ? (a.ai_analysis[0] ?? null) : a.ai_analysis;
        const job = Array.isArray(a.job) ? (a.job[0] ?? null) : a.job;
        return {
          id: a.id,
          job_id: a.job_id,
          job_title: job?.title ?? 'Vaga removida',
          candidate_name: a.candidate_name,
          candidate_email: a.candidate_email,
          status: a.status,
          created_at: a.created_at,
          ai_suspected: !!a.ai_suspected,
          form_completed_at: a.form_completed_at,
          score: analysis?.score ?? null,
          stage_score: analysis?.stage_score ?? null,
          stage_verdict: analysis?.stage_verdict ?? null,
          analysis_status: analysis?.status ?? null,
        };
      });
      setRows(normalized);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    void refetch();
  }, [refetch]);

  // Mesmo padrao do pipeline por vaga: enquanto houver analise rodando, a
  // lista se atualiza sozinha em vez de exigir refresh manual.
  const hasPending = rows.some((r) => !r.analysis_status || r.analysis_status === 'pending');

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void refetch(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, refetch]);

  const countsByStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  const jobs = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.job_id, row.job_title);
    return [...map].map(([id, title]) => ({ id, title }));
  }, [rows]);

  return { rows, loading, refetch, hasPending, countsByStage, jobs };
}
