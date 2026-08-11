// Hook + helpers do módulo de time (colaboradores, scores e metas).
// Scores por área seguem as 5 SCOUT_AREAS; o geral é sempre a média
// arredondada do score mais recente de cada área.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SCOUT_AREAS } from '@/lib/scout-areas';
import type { Database, ScoreSource } from '@/types/database';

export type Collaborator = Database['public']['Tables']['collaborators']['Row'];
export type CollaboratorScore = Database['public']['Tables']['collaborator_scores']['Row'];
export type DevelopmentGoal = Database['public']['Tables']['development_goals']['Row'];

export type CollaboratorWithOverall = Collaborator & { overall: number | null };

// ── Score helpers ────────────────────────────────────────────────────────────

type MinimalScore = Pick<CollaboratorScore, 'area' | 'score' | 'recorded_at'>;

/** Mapa área → score mais recente (último recorded_at vence). */
export function latestScoreByArea(scores: MinimalScore[]): Map<string, number> {
  const sorted = [...scores].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const map = new Map<string, number>();
  for (const s of sorted) map.set(s.area, s.score);
  return map;
}

/** Média arredondada dos scores mais recentes. Null quando não há nenhum. */
export function overallFromLatest(latest: Map<string, number>): number | null {
  const values = SCOUT_AREAS.filter((a) => latest.has(a.key)).map((a) => latest.get(a.key)!);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export type ScoreBatch = {
  recordedAt: string;
  source: ScoreSource;
  overall: number;
  scores: CollaboratorScore[];
};

/**
 * Agrupa scores em batches de avaliação. Cada batch compartilha o mesmo
 * recorded_at (inserimos as 5 linhas com o mesmo timestamp de propósito).
 * Retorna em ordem cronológica crescente.
 */
export function groupScoreBatches(scores: CollaboratorScore[]): ScoreBatch[] {
  const sorted = [...scores].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const map = new Map<string, CollaboratorScore[]>();
  for (const s of sorted) {
    const key = `${s.recorded_at}|${s.source}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  }
  return [...map.values()].map((batch) => ({
    recordedAt: batch[0].recorded_at,
    source: batch[0].source,
    overall: Math.round(batch.reduce((sum, s) => sum + s.score, 0) / batch.length),
    scores: batch,
  }));
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function toDate(iso: string): Date {
  // Datas puras (YYYY-MM-DD) viram meia-noite local pra não voltar um dia por fuso.
  return iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

/** Ex.: "11 de ago. de 2026" */
export function formatDatePtBR(iso: string): string {
  return toDate(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Ex.: "11/08/26" (labels curtos de histórico) */
export function formatShortDatePtBR(iso: string): string {
  return toDate(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/** Mesma escala de cor do ScoutCard pra números de score fora do card. */
export function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-sky-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-500';
}

// ── Hook: lista de colaboradores com overall ─────────────────────────────────

export function useCollaborators() {
  const [collaborators, setCollaborators] = useState<CollaboratorWithOverall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const { data: collabs, error: collabError } = await supabase
      .from('collaborators')
      .select('*')
      .order('hired_at', { ascending: false });

    if (collabError) {
      console.error('[useCollaborators] fetch error:', collabError);
      setError(collabError.message);
      setLoading(false);
      return;
    }

    const { data: scores } = await supabase
      .from('collaborator_scores')
      .select('collaborator_id, area, score, recorded_at');

    const scoresByCollab = new Map<string, MinimalScore[]>();
    for (const s of scores ?? []) {
      const bucket = scoresByCollab.get(s.collaborator_id);
      if (bucket) bucket.push(s);
      else scoresByCollab.set(s.collaborator_id, [s]);
    }

    setCollaborators(
      (collabs ?? []).map((c) => ({
        ...c,
        overall: overallFromLatest(latestScoreByArea(scoresByCollab.get(c.id) ?? [])),
      })),
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { collaborators, loading, error, refetch: fetchAll };
}
