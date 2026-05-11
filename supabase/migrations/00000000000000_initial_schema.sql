-- =============================================================================
-- Nuren — Initial Schema
-- =============================================================================
-- Multi-tenant foundation. Sprint 1 estende com DNA-specific fields.
-- Toda tabela tenant-scoped tem RLS baseada em JWT claim company_id.

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";
-- pg_cron habilitado no dashboard Supabase (Database → Extensions)

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.user_role as enum ('owner', 'recruiter', 'viewer');
create type public.company_plan as enum ('trial', 'starter', 'growth');

-- -----------------------------------------------------------------------------
-- companies — tenant root
-- -----------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (length(name) between 1 and 120),
  plan company_plan not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- DNA: populado pela Sprint 1 (DNA Wizard). Null até completar.
  dna_version int not null default 0,
  dna_document jsonb,
  dna_completed_at timestamptz,
  system_prompt_cached text,

  -- LGPD retention config por empresa
  retention_rejected_months int not null default 12,
  retention_hired_months int not null default 24
);

create index companies_slug_idx on public.companies (slug);

comment on table public.companies is 'Tenant root. Uma row por organização cliente.';
comment on column public.companies.dna_version is 'Incrementa quando DNA é republicado. ai_analyses armazena dna_version_used.';
comment on column public.companies.dna_document is 'DNA estruturado pela IA pós-wizard.';
comment on column public.companies.system_prompt_cached is 'System prompt pré-renderizado pra análises. Regenerado quando DNA muda.';

-- -----------------------------------------------------------------------------
-- users — profile linkado a auth.users
-- -----------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'recruiter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_company_id_idx on public.users (company_id);
create unique index users_email_company_idx on public.users (email, company_id);

comment on table public.users is 'Usuários da aplicação (HR/admin). 1 user = 1 company no v1.';

-- -----------------------------------------------------------------------------
-- audit_log — append-only governance (LGPD + security)
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_log_company_id_idx on public.audit_log (company_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

comment on table public.audit_log is 'Append-only governance log. LGPD compliance + security audit.';

-- -----------------------------------------------------------------------------
-- Auth hook: inject company_id into JWT claims
-- -----------------------------------------------------------------------------
-- Configurar no dashboard Supabase: Auth → Hooks → Custom Access Token →
-- public.custom_access_token_hook

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_company_id uuid;
  user_role text;
begin
  select company_id, role::text
    into user_company_id, user_role
  from public.users
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if user_company_id is not null then
    claims := jsonb_set(claims, '{company_id}', to_jsonb(user_company_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant all on table public.users to supabase_auth_admin;
revoke all on table public.users from authenticated, anon, public;
grant select (id, company_id, role) on table public.users to supabase_auth_admin;

comment on function public.custom_access_token_hook is 'Injeta company_id + user_role nos JWT claims. Configurado em Supabase Auth Hooks.';

-- -----------------------------------------------------------------------------
-- Helper functions pra RLS
-- -----------------------------------------------------------------------------

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'company_id', '')::uuid;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select current_setting('request.jwt.claims', true)::jsonb->>'user_role';
$$;

create or replace function public.has_role(required text)
returns boolean
language sql
stable
as $$
  select public.current_user_role() = required;
$$;

comment on function public.current_company_id is 'Lê company_id dos JWT claims. Base de toda RLS tenant-scoped.';
comment on function public.has_role is 'Checa se user atual tem role específico. Usar em policies de write.';

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.audit_log enable row level security;

-- companies: usuário vê apenas sua própria empresa
create policy "companies_select_own"
  on public.companies
  for select
  to authenticated
  using (id = public.current_company_id());

-- companies: apenas owner edita
create policy "companies_update_owner"
  on public.companies
  for update
  to authenticated
  using (id = public.current_company_id() and public.has_role('owner'))
  with check (id = public.current_company_id() and public.has_role('owner'));

-- companies: INSERT só via service_role (signup flow em edge function).
-- Sem policy pra anon/authenticated insert.

-- users: vê membros da própria empresa
create policy "users_select_same_company"
  on public.users
  for select
  to authenticated
  using (company_id = public.current_company_id());

-- users: pode editar a si mesmo, ou owner edita qualquer um da empresa
create policy "users_update_self_or_owner"
  on public.users
  for update
  to authenticated
  using (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.has_role('owner'))
  )
  with check (
    id = auth.uid()
    or (company_id = public.current_company_id() and public.has_role('owner'))
  );

-- audit_log: read-only pelos usuários da empresa
create policy "audit_log_select_same_company"
  on public.audit_log
  for select
  to authenticated
  using (company_id = public.current_company_id());

-- audit_log: INSERT só via service_role (edge functions / triggers).
-- Sem policy pra anon/authenticated insert.
