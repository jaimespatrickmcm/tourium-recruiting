-- Categorias de pergunta da empresa: sobre o candidato (profile), cultura,
-- raciocínio e curiosidade. `profile` reúne informações e história do candidato
-- (trajetória, conquista, fracasso, salário, regime); `culture` fica pra estilo
-- de pensamento e fit; `curiosity` mede curiosidade e aprendizado por conta
-- própria; `reasoning` segue raciocínio puro.

alter table public.company_questions drop constraint if exists company_questions_kind_check;
alter table public.company_questions add constraint company_questions_kind_check
  check (kind in ('profile', 'culture', 'reasoning', 'curiosity'));

-- Respostas carregam a mesma categoria como origem.
alter table public.application_answers drop constraint if exists application_answers_source_check;
alter table public.application_answers add constraint application_answers_source_check
  check (source in ('candidate_info', 'job_question', 'profile', 'culture', 'reasoning', 'curiosity'));
