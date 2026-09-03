-- Skills do candidato, mapeadas a partir das evidencias que o processo produz.
-- Ver comentarios completos aplicados no banco (migrations candidate_skills e
-- candidate_skills_index_fix).
create table if not exists public.candidate_skills (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('hard', 'soft')),
  level smallint check (level between 1 and 5),
  source text not null check (source in ('cv', 'form', 'interview')),
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists candidate_skills_app_name_source_idx
  on public.candidate_skills (application_id, name, source);
create index if not exists candidate_skills_app_idx
  on public.candidate_skills (application_id);

create trigger candidate_skills_updated_at
  before update on public.candidate_skills
  for each row execute function public.set_updated_at();

alter table public.candidate_skills enable row level security;

create policy "candidate_skills_tenant_all"
  on public.candidate_skills for all
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
