-- Fase pós-contratação: colaboradores, evolução de scores por área e metas de desenvolvimento.

-- 1) Colaboradores (criados ao contratar um candidato, ou manualmente).
create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  full_name text not null,
  email text not null,
  role_title text,
  hired_at date not null default current_date,
  status text not null default 'ativo' check (status in ('ativo', 'desligado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collaborators_company_idx on public.collaborators (company_id, created_at desc);
create index collaborators_candidate_idx on public.collaborators (candidate_id);
-- Uma candidatura só pode virar colaborador uma vez.
create unique index collaborators_application_unique
  on public.collaborators (application_id) where application_id is not null;

create trigger collaborators_set_updated_at
  before update on public.collaborators
  for each row execute function public.set_updated_at();

alter table public.collaborators enable row level security;

create policy collaborators_tenant_select
  on public.collaborators for select to authenticated
  using (company_id = public.current_company_id());

create policy collaborators_tenant_insert
  on public.collaborators for insert to authenticated
  with check (company_id = public.current_company_id());

create policy collaborators_tenant_update
  on public.collaborators for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Colaborador (logado como candidato LinkedIn) vê o próprio registro.
create policy collaborators_self_select
  on public.collaborators for select to authenticated
  using (candidate_id = (select auth.uid()));

grant select, insert, update on public.collaborators to authenticated;

-- 2) Scores por área ao longo do tempo (alimenta o scout card e a linha de evolução).
create table public.collaborator_scores (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  area text not null,
  score int not null check (score between 0 and 100),
  note text,
  source text not null default 'avaliacao' check (source in ('analise_inicial', 'avaliacao')),
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index collaborator_scores_collab_idx on public.collaborator_scores (collaborator_id, recorded_at desc);
create index collaborator_scores_company_idx on public.collaborator_scores (company_id);

alter table public.collaborator_scores enable row level security;

create policy collaborator_scores_tenant_select
  on public.collaborator_scores for select to authenticated
  using (company_id = public.current_company_id());

create policy collaborator_scores_tenant_insert
  on public.collaborator_scores for insert to authenticated
  with check (company_id = public.current_company_id());

create policy collaborator_scores_self_select
  on public.collaborator_scores for select to authenticated
  using (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id
        and c.candidate_id = (select auth.uid())
    )
  );

grant select, insert on public.collaborator_scores to authenticated;

-- 3) Metas de desenvolvimento (a linha do tempo de pra onde a pessoa evolui).
create table public.development_goals (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  area text,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'pausada')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index development_goals_collab_idx on public.development_goals (collaborator_id, created_at desc);
create index development_goals_company_idx on public.development_goals (company_id);

create trigger development_goals_set_updated_at
  before update on public.development_goals
  for each row execute function public.set_updated_at();

alter table public.development_goals enable row level security;

create policy development_goals_tenant_select
  on public.development_goals for select to authenticated
  using (company_id = public.current_company_id());

create policy development_goals_tenant_insert
  on public.development_goals for insert to authenticated
  with check (company_id = public.current_company_id());

create policy development_goals_tenant_update
  on public.development_goals for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy development_goals_self_select
  on public.development_goals for select to authenticated
  using (
    exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id
        and c.candidate_id = (select auth.uid())
    )
  );

grant select, insert, update on public.development_goals to authenticated;
