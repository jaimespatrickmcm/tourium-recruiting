-- Corrige o caminho público de leitura (career page) e as pontes candidato ↔ empresa.

-- 1) View pública da empresa. Roda como owner (postgres), bypassa RLS de companies,
--    e expõe apenas os campos públicos que a career page precisa.
create or replace view public.company_public_profiles as
  select id, slug, name, description
  from public.companies;

grant select on public.company_public_profiles to anon, authenticated;

-- 2) A policy jobs_public_active_read era só pra anon; candidato logado via LinkedIn
--    não conseguia carregar a vaga na career page.
create policy jobs_public_active_read_authed
  on public.jobs for select to authenticated
  using (status = 'active');

-- 3) Empresa pode ler o perfil de candidatos que se aplicaram a alguma vaga dela.
create policy candidates_employer_select
  on public.candidates for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.candidate_id = candidates.id
        and a.company_id = public.current_company_id()
    )
  );

-- 4) Candidato enxerga as próprias candidaturas.
create policy applications_candidate_select
  on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()));

-- 5) candidates_self_update não tinha WITH CHECK, o que permitia um candidato
--    apontar a própria row pra outro id. Recria com o cheque completo.
drop policy if exists candidates_self_update on public.candidates;
create policy candidates_self_update
  on public.candidates for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 6) Dedupe: mesma pessoa não se candidata duas vezes à mesma vaga.
create unique index if not exists applications_job_email_unique
  on public.applications (job_id, lower(candidate_email));
