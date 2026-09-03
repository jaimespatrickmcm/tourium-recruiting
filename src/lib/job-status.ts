// Situação da vaga. Os três estados já existiam no banco desde o início
// (constraint `jobs_status_check`), e a policy pública `jobs_public_active_read`
// só expõe vaga `active` pro anônimo. O que faltava era a tela pra mudar: toda
// vaga nascia ativa e ficava ativa pra sempre.

export type JobStatus = 'active' | 'paused' | 'closed';

export const JOB_STATUSES: JobStatus[] = ['active', 'paused', 'closed'];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  closed: 'Encerrada',
};

export const JOB_STATUS_TONE: Record<JobStatus, string> = {
  active: 'bg-positive-tint text-positive',
  paused: 'bg-warning-tint text-warning',
  closed: 'bg-canvas text-ink-subtle',
};

// O que cada estado faz de verdade. Escrito em consequência, não em adjetivo:
// quem está encerrando uma vaga precisa saber o que acontece com a career page
// e com quem já se candidatou, não ler "vaga inativa".
export const JOB_STATUS_EFFECT: Record<JobStatus, string> = {
  active: 'Aparece na career page e recebe candidatura nova.',
  paused:
    'Sai da career page e para de receber candidatura. Quem já está no processo continua igual, e você pode reativar quando quiser.',
  closed:
    'Sai da career page pra sempre. Use quando o processo acabou, com alguém contratado ou não. Ainda dá pra reabrir, mas o normal é não reabrir.',
};

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as string[]).includes(value);
}

export function jobStatusLabel(value: string): string {
  return isJobStatus(value) ? JOB_STATUS_LABEL[value] : value;
}

export function jobStatusTone(value: string): string {
  return isJobStatus(value) ? JOB_STATUS_TONE[value] : 'bg-canvas text-ink-muted';
}

// Ordem de exibicao da lista de vagas. Ativa primeiro porque e onde o trabalho
// acontece: vaga encerrada e consulta, vaga ativa e operacao. Ordenar so por
// data misturava as duas, e uma vaga encerrada em setembro aparecia acima de uma
// ativa aberta em agosto.
const JOB_STATUS_RANK: Record<JobStatus, number> = {
  active: 0,
  paused: 1,
  closed: 2,
};

export function jobStatusRank(value: string): number {
  // Status desconhecido vai pro fim em vez de se misturar com as ativas.
  return isJobStatus(value) ? JOB_STATUS_RANK[value] : 99;
}

/** Ativa > pausada > encerrada; dentro de cada grupo, mais recente primeiro. */
export function compareJobs(
  a: { status: string; created_at: string },
  b: { status: string; created_at: string },
): number {
  const rank = jobStatusRank(a.status) - jobStatusRank(b.status);
  if (rank !== 0) return rank;
  return b.created_at.localeCompare(a.created_at);
}
