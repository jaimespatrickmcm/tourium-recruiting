-- Nova etapa Fit cultural entre triagem e entrevista (candidato preenche o
-- application form nessa etapa).
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('triagem', 'fit_cultural', 'entrevista', 'proposta', 'contratado', 'reprovado'));
