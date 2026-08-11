-- =============================================================================
-- Security advisor fixes
-- =============================================================================
-- 1. Pin search_path em todas as funções pra evitar search_path injection.
-- 2. Mover extensão pgvector pra schema dedicado (best practice Supabase).

-- -----------------------------------------------------------------------------
-- Pin search_path em funções
-- -----------------------------------------------------------------------------

alter function public.current_company_id() set search_path = '';
alter function public.current_user_role() set search_path = '';
alter function public.has_role(text) set search_path = '';
alter function public.set_updated_at() set search_path = '';

-- -----------------------------------------------------------------------------
-- Mover pgvector pra extensions schema
-- -----------------------------------------------------------------------------

create schema if not exists extensions;
alter extension vector set schema extensions;
