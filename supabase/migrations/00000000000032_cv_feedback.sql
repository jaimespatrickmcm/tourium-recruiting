-- Devolutiva sobre o CURRICULO como peca (nao sobre a pessoa): o que ja esta bom
-- e o que mudaria, com o porque de cada sugestao. Vai pro recrutador e tambem
-- fica no perfil do candidato, entao e a unica parte da analise que o candidato
-- enxerga.
alter table public.ai_analyses add column if not exists cv_feedback jsonb;

comment on column public.ai_analyses.cv_feedback is
  'Devolutiva do curriculo: {strengths: [texto], improvements: [{point, why}]}. Visivel para o candidato.';
