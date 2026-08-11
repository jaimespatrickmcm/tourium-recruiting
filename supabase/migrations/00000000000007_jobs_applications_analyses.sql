-- =============================================================================
-- Core product loop: jobs + applications + ai_analyses
-- =============================================================================
-- Minimum schema pra demonstrar a tese da Noren:
-- empresa cria vaga → candidato aplica no link público → IA analisa usando
-- DNA da empresa + descrição da vaga + dados do candidato → score + reasoning.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);
create index jobs_company_id_idx on public.jobs (company_id, created_at desc);
create index jobs_slug_idx on public.jobs (slug);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_name text not null,
  candidate_email text not null,
  candidate_phone text,
  why_interested text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index applications_job_id_idx on public.applications (job_id, created_at desc);
create index applications_company_id_idx on public.applications (company_id, created_at desc);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  score int,
  recommendation text,
  reasoning text,
  model_used text,
  cost_cents int,
  status text not null default 'pending',
  error_message text,
  ran_at timestamptz not null default now()
);
create index ai_analyses_application_id_idx on public.ai_analyses (application_id);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.ai_analyses enable row level security;

-- Jobs: tenant sees only own
create policy "jobs_tenant_select"
  on public.jobs
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "jobs_tenant_insert"
  on public.jobs
  for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "jobs_tenant_update"
  on public.jobs
  for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Public can read active jobs by slug (for career page)
create policy "jobs_public_active_read"
  on public.jobs
  for select
  to anon
  using (status = 'active');

-- Applications: tenant sees own
create policy "applications_tenant_select"
  on public.applications
  for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "applications_tenant_update"
  on public.applications
  for update
  to authenticated
  using (company_id = public.current_company_id());

-- INSERT into applications is service_role only (via edge function)

-- AI analyses: tenant sees own (via application)
create policy "ai_analyses_tenant_select"
  on public.ai_analyses
  for select
  to authenticated
  using (
    application_id in (
      select id from public.applications where company_id = public.current_company_id()
    )
  );

-- =============================================================================
-- Grants
-- =============================================================================

grant select, insert, update on public.jobs to authenticated;
grant select on public.jobs to anon;
grant select, update on public.applications to authenticated;
grant select on public.ai_analyses to authenticated;
