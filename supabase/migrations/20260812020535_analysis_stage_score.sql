-- Distingue a nota da ETAPA (decisao de avancar, calibrada ao estagio de
-- evidencia) da nota geral acumulada (scout de 5 areas).
alter table public.ai_analyses add column if not exists evidence_stage text;
alter table public.ai_analyses add column if not exists stage_score integer;
alter table public.ai_analyses add column if not exists stage_verdict text;
alter table public.ai_analyses add column if not exists stage_note text;

comment on column public.ai_analyses.evidence_stage is
  'Estagio de evidencia da analise: cv (so curriculo) ou form (com respostas do formulario).';
comment on column public.ai_analyses.stage_score is
  'Fit da etapa (0-100): decisao de avancar, calibrada ao que o estagio permite avaliar.';
comment on column public.ai_analyses.stage_verdict is
  'Veredito da etapa: avancar, segurar ou cortar.';
