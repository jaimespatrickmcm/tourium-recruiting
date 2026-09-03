-- O upsert do map-candidate-skills usa onConflict com nomes de coluna, e isso
-- não casa com índice sobre expressão (lower(name)). Troca por índice de coluna.
-- Aplicada no remoto via MCP; este arquivo espelha o SQL registrado em
-- schema_migrations. O arquivo local de candidate_skills já cria o índice
-- corrigido, então aqui o drop+create é idempotente num reset local.
drop index if exists public.candidate_skills_app_name_source_idx;

create unique index if not exists candidate_skills_app_name_source_idx
  on public.candidate_skills (application_id, name, source);
