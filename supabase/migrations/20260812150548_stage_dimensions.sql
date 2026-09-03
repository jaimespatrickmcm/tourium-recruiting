-- Scout por etapa: dimensoes especificas do estagio de evidencia.
-- cv: experiencia, estabilidade, aderencia_tecnica, disponibilidade, localizacao
-- form: cultura, motivacao, comunicacao, raciocinio
-- Cada item: { area, score (0-100 ou null quando sem dados), rationale }.
alter table public.ai_analyses add column if not exists stage_dimensions jsonb;

comment on column public.ai_analyses.stage_dimensions is
  'Scout da etapa (dimensoes do estagio de evidencia). score null = sem dados, nunca chute. O scout geral (dimensions) passa a ser parcial: area sem evidencia fica ausente (aguardando).';
