-- Minimo de opcoes numa pergunta de multipla escolha. Com uma escolha so nao da
-- pra calibrar a resposta: duas ou mais revelam o padrao por tras da escolha.
alter table public.company_questions add column if not exists min_selections integer not null default 1;
alter table public.job_questions add column if not exists min_selections integer not null default 1;

-- Expor nas views publicas: o formulario precisa saber pra travar o avanco.
create or replace view public.job_questions_public as
  select id, job_id, position, question, required, format, options, min_selections
  from public.job_questions;

create or replace view public.company_questions_public as
  select id, company_id, kind, position, question, required, format, options, min_selections
  from public.company_questions;
