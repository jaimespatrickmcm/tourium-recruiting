-- =============================================================================
-- Add factual company info columns to public.companies
-- =============================================================================
-- Separates "company info" (factual: URL, industry, stage, etc.) from "DNA"
-- (cultural: values, ideal profile, anti-fit, leadership).
-- DNA continues to live in dna_document jsonb. Factual fields become typed cols
-- for queryability + dropdown-friendly UX.

alter table public.companies
  add column if not exists website_url text,
  add column if not exists description text,
  add column if not exists industry text,
  add column if not exists stage text,
  add column if not exists work_model text,
  add column if not exists team_size text,
  add column if not exists company_completed_at timestamptz;

comment on column public.companies.website_url is 'Site da empresa, usado pra enriquecimento via scrape.';
comment on column public.companies.description is 'O que a empresa faz (pré-preenchido por scrape, editável).';
comment on column public.companies.industry is 'Indústria/setor (taxonomia controlada no frontend).';
comment on column public.companies.stage is 'Momento da empresa: early-stage, growth, scale-up, established.';
comment on column public.companies.work_model is 'remoto, hibrido, presencial.';
comment on column public.companies.team_size is 'Tamanho do time (string livre).';
comment on column public.companies.company_completed_at is 'Quando a empresa terminou de configurar info factual (separado do DNA).';
