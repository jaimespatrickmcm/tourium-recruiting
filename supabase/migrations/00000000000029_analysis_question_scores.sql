-- Nota por pergunta, com a justificativa. A nota da etapa passa a ser a media
-- ponderada destas (obrigatoria pesa mais), em vez de um numero holistico que
-- o modelo escolhia no olho e variava entre rodadas.
alter table public.ai_analyses add column if not exists question_scores jsonb;

comment on column public.ai_analyses.question_scores is
  'Nota por pergunta: [{ref_id, score, rationale}]. Base do calculo do fit da etapa e exibida junto da resposta.';
