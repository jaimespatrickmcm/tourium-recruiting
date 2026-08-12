-- Formatos de pergunta no application form: aberta (text), numérica (number),
-- escolha única (single_select) e múltipla escolha (multi_select).
-- `options` guarda a lista de opções (array JSON de strings) quando o formato
-- é de seleção; fica null nas abertas e numéricas.

alter table public.job_questions
  add column if not exists format text not null default 'text'
    check (format in ('text', 'number', 'single_select', 'multi_select')),
  add column if not exists options jsonb;

alter table public.company_questions
  add column if not exists format text not null default 'text'
    check (format in ('text', 'number', 'single_select', 'multi_select')),
  add column if not exists options jsonb;

-- Views públicas expõem formato e opções (o candidato precisa renderizar o
-- input certo). guidance e scoring_rubric continuam internos.
create or replace view public.job_questions_public as
  select id, job_id, position, question, required, format, options
  from public.job_questions;

create or replace view public.company_questions_public as
  select id, company_id, kind, position, question, required, format, options
  from public.company_questions;

-- Histórico imutável por candidatura: além do question_snapshot, congela o
-- critério interno (guidance + rubrica) no momento do submit. Regenerar ou
-- editar perguntas depois nunca altera o que já foi respondido nem o critério
-- que vale pra avaliar aquela resposta. Linhas antigas ficam null e a análise
-- cai no lookup ao vivo por ref_id (comportamento anterior).
alter table public.application_answers
  add column if not exists guidance_snapshot text,
  add column if not exists rubric_snapshot text;
