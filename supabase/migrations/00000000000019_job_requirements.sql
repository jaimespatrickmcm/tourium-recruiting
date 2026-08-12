-- Perfil de requisitos INTERNO da vaga (nunca exposto ao candidato).
-- Gabarito que alimenta a geração das perguntas e a análise dos candidatos.
alter table public.jobs add column if not exists requirements jsonb;

comment on column public.jobs.requirements is
  'Perfil de requisitos interno da vaga (seniority, must_have, nice_to_have, responsibilities, evaluation_focus, red_flags). Uso interno, nunca exposto em superfícies do candidato.';
