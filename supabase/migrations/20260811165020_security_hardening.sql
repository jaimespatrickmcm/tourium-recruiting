-- Hardening pós-review adversarial: escalada de tenant, forja de FK cross-tenant,
-- vazamento de nota interna pro candidato, e infra de rate limit.

-- 1) users: o grant de UPDATE em todas as colunas + policy por id permitia um user
--    trocar o próprio company_id/role e entrar em outro tenant como owner.
--    A UI só edita full_name; trava por grant de coluna.
revoke update on public.users from authenticated;
grant update (full_name) on public.users to authenticated;

-- 2) applications: empresa só precisa mutar status (a policy já limita as rows).
revoke update on public.applications from authenticated;
grant update (status) on public.applications to authenticated;

-- 3) Candidato só vê mudanças de etapa SEM nota. Notas internas ficam em eventos
--    type='note' (a UI da empresa grava a nota num evento separado).
drop policy if exists application_events_candidate_select on public.application_events;
create policy application_events_candidate_select
  on public.application_events for select to authenticated
  using (
    type = 'stage_change'
    and note is null
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.candidate_id = (select auth.uid())
    )
  );

-- 4) Checks de posse nos inserts (antes dava pra apontar FKs pra dados de outro
--    tenant conhecendo o UUID) + actor_id não forjável.
drop policy if exists application_events_tenant_insert on public.application_events;
create policy application_events_tenant_insert
  on public.application_events for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and (actor_id is null or actor_id = (select auth.uid()))
    and exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.company_id = public.current_company_id()
    )
  );

drop policy if exists collaborators_tenant_insert on public.collaborators;
create policy collaborators_tenant_insert
  on public.collaborators for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and (
      application_id is null
      or exists (
        select 1 from public.applications a
        where a.id = application_id
          and a.company_id = public.current_company_id()
      )
    )
    and (
      candidate_id is null
      or exists (
        select 1 from public.applications a
        where a.candidate_id = collaborators.candidate_id
          and a.company_id = public.current_company_id()
      )
    )
  );

drop policy if exists collaborator_scores_tenant_insert on public.collaborator_scores;
create policy collaborator_scores_tenant_insert
  on public.collaborator_scores for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and (actor_id is null or actor_id = (select auth.uid()))
    and exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id
        and c.company_id = public.current_company_id()
    )
  );

drop policy if exists development_goals_tenant_insert on public.development_goals;
create policy development_goals_tenant_insert
  on public.development_goals for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.collaborators c
      where c.id = collaborator_id
        and c.company_id = public.current_company_id()
    )
  );

-- 5) Candidato lê as vagas onde aplicou mesmo depois de fechadas
--    (senão o portal mostra "Vaga encerrada" sem título).
create policy jobs_candidate_applied_read
  on public.jobs for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.job_id = jobs.id
        and a.candidate_id = (select auth.uid())
    )
  );

-- 6) Rate limit do form público (usada pelo submit-application via service_role).
--    RLS ligado sem policy nenhuma: só service_role enxerga.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on public.rate_limit_hits (key, created_at desc);
alter table public.rate_limit_hits enable row level security;
