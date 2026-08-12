-- Perguntas obrigatórias: bloqueiam avançar vazio no formulário.
alter table public.job_questions add column if not exists required boolean not null default false;
alter table public.company_questions add column if not exists required boolean not null default false;

-- Expor `required` nas views públicas (o candidato precisa saber o que é obrigatório).
create or replace view public.job_questions_public as
  select id, job_id, position, question, required
  from public.job_questions;

create or replace view public.company_questions_public as
  select id, company_id, kind, position, question, required
  from public.company_questions;
