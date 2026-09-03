-- Vaga pública (aparece no portal de vagas futuro, casada por região/cultura) vs privada
-- (só acessível por link direto da career page). Default privada: a empresa opta por publicar.

alter table public.jobs
  add column if not exists visibility text not null default 'private'
    check (visibility in ('public', 'private'));

-- View do portal público de vagas: só vagas ativas E marcadas como públicas.
-- Junta o nome/slug da empresa pra montar o link da career page.
create or replace view public.public_job_board as
  select
    j.id,
    j.slug as job_slug,
    j.title,
    j.description,
    j.created_at,
    c.slug as company_slug,
    c.name as company_name
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.status = 'active' and j.visibility = 'public';

grant select on public.public_job_board to anon, authenticated;
