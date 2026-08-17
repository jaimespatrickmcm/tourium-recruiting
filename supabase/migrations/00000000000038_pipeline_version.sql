-- Versão do pipeline de análise que produziu cada linha.
--
-- Até aqui, saber se uma análise estava velha dependia de olhar a data ou de
-- adivinhar por campo faltando ("tem strengths? tem potential_breakdown?").
-- Os dois jeitos erram: campo pode vir vazio numa análise nova (candidato sem
-- currículo não tem cv_feedback), e data não diz qual mudança entrou.
--
-- Com um inteiro explícito, "desatualizado" vira comparação, não palpite. Toda
-- vez que uma mudança no prompt ou no cálculo exigir reprocessamento, sobe o
-- ANALYSIS_PIPELINE_VERSION no analyze-candidate e a UI passa a mostrar quantos
-- ficaram pra trás.
--
-- Default 1 pras linhas que já existem: nenhuma delas viu o pipeline atual.

alter table public.ai_analyses
  add column if not exists pipeline_version integer not null default 1;

comment on column public.ai_analyses.pipeline_version is
  'Versão do pipeline de análise que gerou esta linha. Comparar com ANALYSIS_PIPELINE_VERSION do edge function analyze-candidate pra saber o que precisa reprocessar.';

create index if not exists ai_analyses_pipeline_version_idx
  on public.ai_analyses (pipeline_version);
