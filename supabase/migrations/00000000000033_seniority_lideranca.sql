-- "lead" vazava termo em ingles pro texto que o recrutador le, e em vaga
-- comercial "lead" em portugues significa prospect. Vira "lideranca".
update public.jobs
set requirements = jsonb_set(requirements, '{seniority}', '"lideranca"'::jsonb)
where requirements->>'seniority' = 'lead';
