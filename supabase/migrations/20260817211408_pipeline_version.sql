-- Versão do pipeline de análise. Aplicada no remoto via MCP em 2026-08-17;
-- este arquivo espelha o SQL registrado em supabase_migrations.schema_migrations.

alter table public.ai_analyses
  add column if not exists pipeline_version integer not null default 1;

comment on column public.ai_analyses.pipeline_version is
  'Versão do pipeline de análise que gerou esta linha. Comparar com ANALYSIS_PIPELINE_VERSION do edge function analyze-candidate pra saber o que precisa reprocessar.';

create index if not exists ai_analyses_pipeline_version_idx
  on public.ai_analyses (pipeline_version);
