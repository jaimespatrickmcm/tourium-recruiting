-- Próxima leva: application form multi-seção, perguntas geradas, acesso do candidato por token.

-- ============================================================
-- 1) Perguntas de cultura e raciocínio (vivem "no DNA", company-scoped, com rubrica)
-- ============================================================
create table public.company_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('culture', 'reasoning')),
  position int not null default 0,
  question text not null,
  guidance text,            -- o que se espera da resposta (interno)
  scoring_rubric text,      -- como pontuar pra aprovar (interno)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_questions_company_idx on public.company_questions (company_id, kind, position);

create trigger company_questions_set_updated_at
  before update on public.company_questions
  for each row execute function public.set_updated_at();

alter table public.company_questions enable row level security;

create policy company_questions_tenant_select on public.company_questions for select to authenticated
  using (company_id = public.current_company_id());
create policy company_questions_tenant_insert on public.company_questions for insert to authenticated
  with check (company_id = public.current_company_id());
create policy company_questions_tenant_update on public.company_questions for update to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy company_questions_tenant_delete on public.company_questions for delete to authenticated
  using (company_id = public.current_company_id());

grant select, insert, update, delete on public.company_questions to authenticated;

-- View pública: só o texto da pergunta (sem guidance/rubrica), pro form público renderizar.
create or replace view public.company_questions_public as
  select id, company_id, kind, position, question
  from public.company_questions;
grant select on public.company_questions_public to anon, authenticated;

-- ============================================================
-- 2) Perguntas técnicas por vaga
-- ============================================================
create table public.job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  position int not null default 0,
  question text not null,
  guidance text,
  scoring_rubric text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_questions_job_idx on public.job_questions (job_id, position);

create trigger job_questions_set_updated_at
  before update on public.job_questions
  for each row execute function public.set_updated_at();

alter table public.job_questions enable row level security;

create policy job_questions_tenant_select on public.job_questions for select to authenticated
  using (company_id = public.current_company_id());
create policy job_questions_tenant_insert on public.job_questions for insert to authenticated
  with check (company_id = public.current_company_id());
create policy job_questions_tenant_update on public.job_questions for update to authenticated
  using (company_id = public.current_company_id()) with check (company_id = public.current_company_id());
create policy job_questions_tenant_delete on public.job_questions for delete to authenticated
  using (company_id = public.current_company_id());

grant select, insert, update, delete on public.job_questions to authenticated;

create or replace view public.job_questions_public as
  select id, job_id, position, question
  from public.job_questions;
grant select on public.job_questions_public to anon, authenticated;

-- ============================================================
-- 3) Respostas do application form (gravadas via edge function com service role)
-- ============================================================
create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null check (source in ('candidate_info', 'job_question', 'culture', 'reasoning')),
  ref_id uuid,                 -- job_question_id ou company_question_id, quando aplicável
  question_snapshot text not null,  -- texto da pergunta no momento da resposta
  answer text,
  created_at timestamptz not null default now()
);
create index application_answers_app_idx on public.application_answers (application_id);

alter table public.application_answers enable row level security;

-- Empresa lê as respostas das próprias applications. Insert é só service role (edge fn).
create policy application_answers_tenant_select on public.application_answers for select to authenticated
  using (company_id = public.current_company_id());
grant select on public.application_answers to authenticated;

-- Marca quando o application form completo foi respondido + cidade do candidato.
alter table public.applications add column if not exists city text;
alter table public.applications add column if not exists form_completed_at timestamptz;

-- ============================================================
-- 4) Acesso do candidato por TOKEN (sem OAuth). Tudo servido via edge function
--    com service role, então essas tabelas têm RLS ligado e nenhuma policy.
-- ============================================================
create table public.applicant_profiles (
  email text primary key,
  full_name text,
  phone text,
  city text,
  linkedin_url text,
  picture_url text,
  about text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger applicant_profiles_set_updated_at
  before update on public.applicant_profiles
  for each row execute function public.set_updated_at();
alter table public.applicant_profiles enable row level security;

create table public.applicant_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index applicant_tokens_email_idx on public.applicant_tokens (email);
alter table public.applicant_tokens enable row level security;
