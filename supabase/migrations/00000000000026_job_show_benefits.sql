-- Cada vaga decide se exibe os beneficios da empresa na career page.
-- Os beneficios em si moram em companies.dna_document->'benefits' (lista de itens).
alter table public.jobs add column if not exists show_benefits boolean not null default true;

comment on column public.jobs.show_benefits is
  'Se a career page desta vaga mostra os beneficios cadastrados no DNA da empresa.';
