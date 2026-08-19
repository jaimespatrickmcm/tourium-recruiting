// Nota por etapa: qual etapa tem nota, e de onde ela vem.
//
// O board misturava dois eixos diferentes:
//   status         = onde o RECRUTADOR colocou a pessoa (decisão humana)
//   evidence_stage = que EVIDÊNCIA a análise usou (currículo ou formulário)
//
// Como o card mostrava a nota vigente sob o rótulo da etapa atual, alguém
// movido pra "fit cultural" sem ter respondido o formulário aparecia com nota
// de fit cultural que na verdade saiu do currículo. Não dava pra saber, olhando
// o board, quem tinha respondido e quem só tinha sido arrastado de coluna.
//
// A regra que corrige isso: uma etapa só tem nota quando tem evidência PRÓPRIA.

import type { ApplicationStatus } from '@/types/database';

export type EvidenceStage = 'cv' | 'form';

// Etapa -> evidência que justifica uma nota naquela etapa.
//
// `entrevista` está fora de propósito: ainda não existe nenhuma fonte de dado
// de entrevista no produto (nem nota do entrevistador, nem transcrição). Enquanto
// não existir, a etapa aparece sem nota em vez de reaproveitar a nota do
// formulário, que mediria outra coisa.
export const STAGE_EVIDENCE: Partial<Record<ApplicationStatus, EvidenceStage>> = {
  triagem: 'cv',
  fit_cultural: 'form',
};

// Etapas que entram na trilha de histórico, na ordem do funil.
export const SCORED_STAGES: ApplicationStatus[] = ['triagem', 'fit_cultural', 'entrevista'];

export type StageScore = {
  stage: ApplicationStatus;
  score: number | null;
  verdict: string | null;
  ranAt: string | null;
};

// Uma linha do log append-only application_stage_scores.
export type StageScoreRow = {
  application_id: string;
  evidence_stage: string | null;
  stage_score: number | null;
  stage_verdict: string | null;
  created_at: string;
};

/**
 * Monta a trilha de notas de um candidato a partir do histórico.
 *
 * O log é append-only e a re-análise grava uma linha nova, então a mesma etapa
 * pode ter várias entradas. Fica valendo a mais recente: é a que reflete a régua
 * atual, e as antigas foram feitas com critério que já não vale.
 */
export function buildStageTrack(
  rows: StageScoreRow[],
  // Análise vigente, usada como plano B. O log de histórico só passou a existir
  // em 13/08, então análise mais velha que isso não tem linha nenhuma lá. Sem
  // esse plano B, candidato analisado antes apareceria como "aguardando
  // análise" mesmo tendo nota na tela ao lado.
  current?: {
    evidence_stage: string | null;
    stage_score: number | null;
    stage_verdict: string | null;
    ran_at: string | null;
    status: string;
  } | null,
): Map<ApplicationStatus, StageScore> {
  const track = new Map<ApplicationStatus, StageScore>();
  // Mais recente primeiro, pra primeira que chegar de cada etapa ser a que fica.
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const row of sorted) {
    const stage = stageForEvidence(row.evidence_stage);
    if (!stage || track.has(stage)) continue;
    track.set(stage, {
      stage,
      score: row.stage_score,
      verdict: row.stage_verdict,
      ranAt: row.created_at,
    });
  }

  if (current && current.status === 'completed') {
    const stage = stageForEvidence(current.evidence_stage);
    if (stage && !track.has(stage)) {
      track.set(stage, {
        stage,
        score: current.stage_score,
        verdict: current.stage_verdict,
        ranAt: current.ran_at,
      });
    }
  }

  return track;
}

/** Evidência -> etapa que ela pontua. Desconhecida não vira etapa nenhuma. */
export function stageForEvidence(evidence: string | null): ApplicationStatus | null {
  for (const [stage, ev] of Object.entries(STAGE_EVIDENCE)) {
    if (ev === evidence) return stage as ApplicationStatus;
  }
  return null;
}

/**
 * O que falta pra etapa ter nota. Null quando a etapa já tem, ou quando ela não
 * é do tipo que recebe nota (proposta, contratado, reprovado).
 */
export function missingEvidenceLabel(
  status: ApplicationStatus,
  track: Map<ApplicationStatus, StageScore>,
): string | null {
  if (track.has(status)) return null;
  if (status === 'triagem') return 'aguardando análise';
  if (status === 'fit_cultural') return 'aguardando resposta do formulário';
  if (status === 'entrevista') return 'entrevista ainda não avaliada';
  return null;
}
