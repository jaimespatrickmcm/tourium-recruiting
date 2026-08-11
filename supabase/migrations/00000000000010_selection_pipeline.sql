-- Pipeline de seleção: etapas com histórico + scoring por área + DNA versionado de fato.

-- 1) Normaliza e trava o status de applications (etapas fixas do v1).
update public.applications
  set status = 'triagem'
  where status not in ('triagem', 'entrevista', 'proposta', 'contratado', 'reprovado');

alter table public.applications alter column status set default 'triagem';
alter table public.applications add constraint applications_status_check
  check (status in ('triagem', 'entrevista', 'proposta', 'contratado', 'reprovado'));

alter table public.applications add column if not exists updated_at timestamptz not null default now();
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- 2) Trava o status de jobs (era texto livre).
update public.jobs set status = 'active'
  where status not in ('active', 'paused', 'closed');
alter table public.jobs add constraint jobs_status_check
  check (status in ('active', 'paused', 'closed'));

-- 3) Histórico de eventos da candidatura (mudança de etapa, notas, contratação).
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null default 'stage_change' check (type in ('stage_change', 'note', 'hired')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index application_events_app_idx on public.application_events (application_id, created_at desc);
create index application_events_company_idx on public.application_events (company_id, created_at desc);

alter table public.application_events enable row level security;

create policy application_events_tenant_select
  on public.application_events for select to authenticated
  using (company_id = public.current_company_id());

create policy application_events_tenant_insert
  on public.application_events for insert to authenticated
  with check (company_id = public.current_company_id());

-- Candidato vê a linha do tempo das próprias candidaturas.
create policy application_events_candidate_select
  on public.application_events for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.candidate_id = (select auth.uid())
    )
  );

grant select, insert on public.application_events to authenticated;

-- 4) Scoring por área (base do scout card) + rastreio da versão do DNA usada.
alter table public.ai_analyses
  add column if not exists dimensions jsonb,
  add column if not exists dna_version_used int;

-- 5) DNA versionado de verdade: bump automático quando o documento muda.
create or replace function public.bump_dna_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.dna_document is distinct from old.dna_document then
    new.dna_version := coalesce(old.dna_version, 0) + 1;
  end if;
  return new;
end;
$$;

create trigger companies_bump_dna_version
  before update on public.companies
  for each row execute function public.bump_dna_version();

update public.companies set dna_version = 1
  where dna_version = 0 and dna_document is not null;
