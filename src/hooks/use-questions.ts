import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { QuestionKind } from '@/types/database';

export type CompanyQuestion = {
  id: string;
  kind: QuestionKind;
  position: number;
  question: string;
  guidance: string | null;
  scoring_rubric: string | null;
};

export type JobQuestion = {
  id: string;
  job_id: string;
  position: number;
  question: string;
  guidance: string | null;
  scoring_rubric: string | null;
};

export type QuestionPatch = {
  question?: string;
  guidance?: string | null;
  scoring_rubric?: string | null;
};

export function useCompanyQuestions() {
  const [questions, setQuestions] = useState<CompanyQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('company_questions')
      .select('id, kind, position, question, guidance, scoring_rubric')
      .order('kind', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[useCompanyQuestions] fetch error:', error);
    }
    setQuestions((data as CompanyQuestion[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { questions, loading, refetch };
}

export function useJobQuestions() {
  const [questions, setQuestions] = useState<JobQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('job_questions')
      .select('id, job_id, position, question, guidance, scoring_rubric')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[useJobQuestions] fetch error:', error);
    }
    setQuestions((data as JobQuestion[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { questions, loading, refetch };
}

export async function updateCompanyQuestion(id: string, patch: QuestionPatch) {
  return supabase
    .from('company_questions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq('id', id);
}

export async function deleteCompanyQuestion(id: string) {
  return supabase.from('company_questions').delete().eq('id', id);
}

export async function updateJobQuestion(id: string, patch: QuestionPatch) {
  return supabase
    .from('job_questions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq('id', id);
}

export async function deleteJobQuestion(id: string) {
  return supabase.from('job_questions').delete().eq('id', id);
}
