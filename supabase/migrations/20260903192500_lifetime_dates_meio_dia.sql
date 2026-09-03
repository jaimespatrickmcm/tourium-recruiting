-- Datas puras (hired_at, effective_from, review_date) entravam na timeline
-- como meia-noite UTC, e o navegador em America/Sao_Paulo renderizava 21h do
-- dia ANTERIOR: todo evento de contratação, salário e avaliação aparecia com
-- data errada. Meio-dia UTC renderiza no mesmo dia em qualquer fuso ±12h.

create or replace function public.get_collaborator_lifetime(target_collaborator_id uuid)
returns table (
  event_id uuid,
  event_type text,
  occurred_at timestamptz,
  title text,
  score numeric,
  amount_minor bigint,
  currency text,
  skill_id uuid,
  goal_id uuid,
  source_id uuid,
  metadata jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.can_access_collaborator(target_collaborator_id) then
    raise exception 'not authorized for collaborator' using errcode = '42501';
  end if;

  return query
  select timeline.*
  from (
  select e.id, e.event_type, e.occurred_at, e.title,
         null::numeric, null::bigint, null::text, null::uuid, null::uuid,
         e.id, e.metadata
  from public.employment_events e
  where e.collaborator_id = target_collaborator_id

  union all

  select r.id, 'review_closed'::text,
         coalesce(r.closed_at, (r.review_date::timestamp + interval '12 hours') at time zone 'UTC'),
         r.title, r.overall_score, null::bigint, null::text,
         null::uuid, null::uuid, r.id,
         jsonb_build_object('kind', r.kind, 'review_date', r.review_date)
  from public.performance_reviews r
  where r.collaborator_id = target_collaborator_id and r.status = 'closed'

  union all

  select s.id, 'salary_changed'::text,
         (s.effective_from::timestamp + interval '12 hours') at time zone 'UTC',
         'Alteração salarial'::text, null::numeric, s.amount_minor,
         s.currency::text, null::uuid, null::uuid, s.id,
         jsonb_build_object('reason', s.reason, 'effective_to', s.effective_to)
  from public.salary_history s
  where s.collaborator_id = target_collaborator_id

  union all

  select cs.skill_id, 'skill_unlocked'::text, cs.unlocked_at,
         sk.name::text, cs.level::numeric, null::bigint, null::text,
         cs.skill_id, null::uuid, cs.skill_id,
         jsonb_build_object('evidence', cs.evidence, 'source_review_id', cs.source_review_id)
  from public.collaborator_skills cs
  join public.skills sk on sk.id = cs.skill_id
  where cs.collaborator_id = target_collaborator_id and cs.status = 'unlocked'

  union all

  select g.id, 'development_goal_completed'::text, g.completed_at,
         g.title, g.progress_percent::numeric, null::bigint, null::text,
         g.skill_id, g.id, g.id,
         jsonb_build_object('plan_id', g.plan_id, 'success_criteria', g.success_criteria)
  from public.development_plan_goals g
  join public.development_plans p on p.id = g.plan_id
  where p.collaborator_id = target_collaborator_id and g.status = 'completed'

  union all

  select c.id, 'development_checkin'::text, c.occurred_at,
         'Check-in de desenvolvimento'::text, c.progress_percent::numeric,
         null::bigint, null::text, null::uuid, c.goal_id, c.id,
         jsonb_build_object('plan_id', c.plan_id, 'note', c.note)
  from public.development_checkins c
  join public.development_plans p on p.id = c.plan_id
  where p.collaborator_id = target_collaborator_id

  ) timeline(event_id, event_type, occurred_at, title, score, amount_minor,
             currency, skill_id, goal_id, source_id, metadata)
  order by timeline.occurred_at desc, timeline.event_id desc;
end;
$$;

-- Os eventos de contratação do backfill foram gravados à meia-noite UTC pelo
-- mesmo motivo. Só esses são deslocados: eventos novos nascem com timestamp real.
update public.employment_events
set occurred_at = occurred_at + interval '12 hours'
where event_type = 'hired'
  and occurred_at = date_trunc('day', occurred_at);
