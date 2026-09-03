-- =============================================================================
-- Post-hire development
-- =============================================================================
-- Private employee data, dated/360 reviews, salary history, skills, PDI and
-- lifetime. Authorization in this release is intentionally narrow:
--   * owner: records from their own company
--   * employee: only the collaborator linked to auth.uid()
--   * 360 evaluator: only their own assignment/response

create extension if not exists citext with schema extensions;

begin;

-- -----------------------------------------------------------------------------
-- Collaborator identity and employment access
-- -----------------------------------------------------------------------------

alter table public.collaborators
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists corporate_email extensions.citext,
  add column if not exists pending_corporate_email extensions.citext,
  add column if not exists access_status text not null default 'pending'
    check (access_status in ('pending', 'active', 'revoked')),
  add column if not exists employment_ended_at date;

create unique index if not exists collaborators_auth_user_unique
  on public.collaborators (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists collaborators_active_corporate_email_unique
  on public.collaborators (company_id, corporate_email)
  where corporate_email is not null and access_status <> 'revoked';

-- Supports tenant-safe composite foreign keys in all post-hire tables.
create unique index if not exists collaborators_id_company_unique
  on public.collaborators (id, company_id);

create index if not exists collaborators_access_lookup_idx
  on public.collaborators (auth_user_id, access_status, status);

-- -----------------------------------------------------------------------------
-- Central authorization helpers
-- -----------------------------------------------------------------------------

create or replace function public.is_company_owner(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.company_id = target_company_id
      and u.role = 'owner'::public.user_role
  );
$$;

create or replace function public.is_collaborator_self(target_collaborator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.collaborators c
    where c.id = target_collaborator_id
      and c.auth_user_id = (select auth.uid())
      and c.access_status = 'active'
      and c.status = 'ativo'
  );
$$;

create or replace function public.can_access_collaborator(target_collaborator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.collaborators c
    where c.id = target_collaborator_id
      and (
        public.is_company_owner(c.company_id)
        or (
          c.auth_user_id = (select auth.uid())
          and c.access_status = 'active'
          and c.status = 'ativo'
        )
      )
  );
$$;

revoke all on function public.is_company_owner(uuid) from public, anon;
revoke all on function public.is_collaborator_self(uuid) from public, anon;
revoke all on function public.can_access_collaborator(uuid) from public, anon;
grant execute on function public.is_company_owner(uuid) to authenticated;
grant execute on function public.is_collaborator_self(uuid) to authenticated;
grant execute on function public.can_access_collaborator(uuid) to authenticated;

-- company_id and access linkage are never self-service fields. An owner may
-- manage them through the privileged access flow; an employee may update only
-- non-authorizing collaborator fields.
create or replace function public.guard_collaborator_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot be changed' using errcode = '42501';
  end if;

  if coalesce((select auth.role()), '') <> 'service_role'
     and not public.is_company_owner(old.company_id) and (
    new.candidate_id is distinct from old.candidate_id
    or new.application_id is distinct from old.application_id
    or new.auth_user_id is distinct from old.auth_user_id
    or new.corporate_email is distinct from old.corporate_email
    or new.pending_corporate_email is distinct from old.pending_corporate_email
    or new.access_status is distinct from old.access_status
    or new.status is distinct from old.status
    or new.hired_at is distinct from old.hired_at
    or new.employment_ended_at is distinct from old.employment_ended_at
  ) then
    raise exception 'employee cannot change protected employment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_collaborator_protected_fields() from public, anon, authenticated;

drop trigger if exists collaborators_guard_protected_fields on public.collaborators;
create trigger collaborators_guard_protected_fields
  before update on public.collaborators
  for each row execute function public.guard_collaborator_protected_fields();

-- Replace the old tenant-wide policies. Recruiter/viewer access is deliberately
-- removed until field/manager permissions are designed.
drop policy if exists collaborators_tenant_select on public.collaborators;
drop policy if exists collaborators_tenant_insert on public.collaborators;
drop policy if exists collaborators_tenant_update on public.collaborators;
drop policy if exists collaborators_self_select on public.collaborators;

create policy collaborators_owner_or_self_select
  on public.collaborators for select to authenticated
  using (public.can_access_collaborator(id));

create policy collaborators_owner_insert
  on public.collaborators for insert to authenticated
  with check (public.is_company_owner(company_id));

create policy collaborators_owner_or_self_update
  on public.collaborators for update to authenticated
  using (public.can_access_collaborator(id))
  with check (public.can_access_collaborator(id));

-- Existing score and goal data follows the same owner/self boundary while it
-- remains available for compatibility.
drop policy if exists collaborator_scores_tenant_select on public.collaborator_scores;
drop policy if exists collaborator_scores_tenant_insert on public.collaborator_scores;
drop policy if exists collaborator_scores_self_select on public.collaborator_scores;

create policy collaborator_scores_owner_or_self_select
  on public.collaborator_scores for select to authenticated
  using (public.can_access_collaborator(collaborator_id));

create policy collaborator_scores_owner_or_self_insert
  on public.collaborator_scores for insert to authenticated
  with check (
    public.can_access_collaborator(collaborator_id)
    and company_id = (
      select c.company_id from public.collaborators c where c.id = collaborator_id
    )
    and (actor_id is null or actor_id = (select auth.uid()))
  );

drop policy if exists development_goals_tenant_select on public.development_goals;
drop policy if exists development_goals_tenant_insert on public.development_goals;
drop policy if exists development_goals_tenant_update on public.development_goals;
drop policy if exists development_goals_self_select on public.development_goals;

create policy development_goals_owner_or_self_select
  on public.development_goals for select to authenticated
  using (public.can_access_collaborator(collaborator_id));

create policy development_goals_owner_or_self_insert
  on public.development_goals for insert to authenticated
  with check (
    public.can_access_collaborator(collaborator_id)
    and company_id = (
      select c.company_id from public.collaborators c where c.id = collaborator_id
    )
  );

create policy development_goals_owner_or_self_update
  on public.development_goals for update to authenticated
  using (public.can_access_collaborator(collaborator_id))
  with check (
    public.can_access_collaborator(collaborator_id)
    and company_id = (
      select c.company_id from public.collaborators c where c.id = collaborator_id
    )
  );

-- -----------------------------------------------------------------------------
-- Private profile and salary
-- -----------------------------------------------------------------------------

create table public.collaborator_private_profiles (
  collaborator_id uuid primary key,
  company_id uuid not null,
  birth_date date,
  address jsonb check (address is null or jsonb_typeof(address) = 'object'),
  shirt_size text check (shirt_size is null or length(shirt_size) <= 30),
  food_preferences text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  personal_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(personal_data) = 'object' and pg_column_size(personal_data) <= 16384),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade
);

create index collaborator_private_profiles_company_idx
  on public.collaborator_private_profiles (company_id, collaborator_id);

create table public.salary_history (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null,
  company_id uuid not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to > effective_from),
  reason text check (reason is null or length(reason) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade,
  unique (collaborator_id, effective_from)
);

create index salary_history_company_collaborator_idx
  on public.salary_history (company_id, collaborator_id, effective_from desc);

create or replace function public.prevent_salary_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Serialize salary changes for the same collaborator, including direct CRUD.
  perform pg_advisory_xact_lock(hashtextextended(new.collaborator_id::text, 37));

  if exists (
    select 1
    from public.salary_history s
    where s.collaborator_id = new.collaborator_id
      and s.id <> new.id
      and daterange(s.effective_from, s.effective_to, '[)')
          && daterange(new.effective_from, new.effective_to, '[)')
  ) then
    raise exception 'salary periods cannot overlap' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_salary_overlap() from public, anon, authenticated;

create trigger salary_history_prevent_overlap
  before insert or update on public.salary_history
  for each row execute function public.prevent_salary_overlap();

-- -----------------------------------------------------------------------------
-- Dated and 360 reviews
-- -----------------------------------------------------------------------------

create table public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  collaborator_id uuid not null,
  kind text not null default 'standard' check (kind in ('standard', '360')),
  title text not null check (length(title) between 1 and 200),
  review_date date not null,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  overall_score numeric(5,2) check (overall_score between 0 and 100),
  summary text check (summary is null or length(summary) <= 10000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start is null or period_end is null or period_end >= period_start),
  check ((status = 'closed') = (closed_at is not null)),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade,
  unique (id, company_id)
);

create index performance_reviews_company_collaborator_idx
  on public.performance_reviews (company_id, collaborator_id, review_date desc);

create table public.review_dimensions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  review_id uuid not null,
  skill_id uuid,
  name text not null check (length(name) between 1 and 160),
  description text check (description is null or length(description) <= 3000),
  weight numeric(8,4) not null default 1 check (weight > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (review_id, company_id)
    references public.performance_reviews(id, company_id) on delete cascade,
  unique (review_id, id),
  unique (id, company_id),
  unique (review_id, position)
);

create index review_dimensions_review_idx
  on public.review_dimensions (review_id, position);

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  review_id uuid not null,
  evaluator_user_id uuid references auth.users(id) on delete set null,
  evaluator_email extensions.citext,
  relationship text not null
    check (relationship in ('self', 'manager', 'peer', 'direct_report', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted')),
  access_token_hash text unique,
  access_token_expires_at timestamptz,
  access_token_used_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (review_id, company_id)
    references public.performance_reviews(id, company_id) on delete cascade,
  check (evaluator_user_id is not null or evaluator_email is not null),
  check ((status = 'submitted') = (submitted_at is not null)),
  unique (id, company_id)
);

create unique index review_assignments_user_unique
  on public.review_assignments (review_id, evaluator_user_id)
  where evaluator_user_id is not null;

create index review_assignments_evaluator_idx
  on public.review_assignments (evaluator_user_id, status);

create table public.review_responses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  assignment_id uuid not null unique,
  overall_comment text check (overall_comment is null or length(overall_comment) <= 10000),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, company_id)
    references public.review_assignments(id, company_id) on delete cascade,
  unique (id, company_id)
);

create table public.review_response_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  response_id uuid not null,
  dimension_id uuid not null,
  score numeric(5,2) not null check (score between 0 and 100),
  comment text check (comment is null or length(comment) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (response_id, company_id)
    references public.review_responses(id, company_id) on delete cascade,
  foreign key (dimension_id, company_id)
    references public.review_dimensions(id, company_id) on delete cascade,
  unique (response_id, dimension_id)
);

create index review_response_items_response_idx
  on public.review_response_items (response_id);

-- -----------------------------------------------------------------------------
-- Skills
-- -----------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name extensions.citext not null check (length(name::text) between 1 and 160),
  description text check (description is null or length(description) <= 3000),
  category text check (category is null or length(category) <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

create index skills_company_active_idx
  on public.skills (company_id, active, name);

alter table public.review_dimensions
  add constraint review_dimensions_skill_fk
  foreign key (skill_id) references public.skills(id) on delete set null;

create table public.collaborator_skills (
  collaborator_id uuid not null,
  skill_id uuid not null,
  company_id uuid not null,
  level smallint not null default 1 check (level between 1 and 5),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'unlocked')),
  unlocked_at timestamptz,
  evidence text check (evidence is null or length(evidence) <= 5000),
  source_review_id uuid references public.performance_reviews(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade,
  foreign key (skill_id, company_id)
    references public.skills(id, company_id) on delete cascade,
  primary key (collaborator_id, skill_id),
  check ((status = 'unlocked') = (unlocked_at is not null))
);

create index collaborator_skills_company_collaborator_idx
  on public.collaborator_skills (company_id, collaborator_id, status);

-- -----------------------------------------------------------------------------
-- Individual development plans
-- -----------------------------------------------------------------------------

create table public.development_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  collaborator_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 10000),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'cancelled')),
  starts_at date,
  target_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or target_date is null or target_date >= starts_at),
  check ((status = 'completed') = (completed_at is not null)),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade,
  unique (id, company_id)
);

create index development_plans_company_collaborator_idx
  on public.development_plans (company_id, collaborator_id, created_at desc);

create table public.development_plan_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  plan_id uuid not null,
  skill_id uuid references public.skills(id) on delete set null,
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 5000),
  target_level smallint check (target_level between 1 and 5),
  success_criteria text check (success_criteria is null or length(success_criteria) <= 5000),
  due_date date,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'paused')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  completed_at timestamptz,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, company_id)
    references public.development_plans(id, company_id) on delete cascade,
  check ((status = 'completed') = (completed_at is not null)),
  unique (plan_id, position),
  unique (id, company_id)
);

create index development_plan_goals_plan_idx
  on public.development_plan_goals (plan_id, position);

create table public.development_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  goal_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 5000),
  kind text not null default 'other'
    check (kind in ('course', 'practice', 'mentoring', 'reading', 'other')),
  due_date date,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'cancelled')),
  completed_at timestamptz,
  resource_url text check (resource_url is null or length(resource_url) <= 2000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (goal_id, company_id)
    references public.development_plan_goals(id, company_id) on delete cascade,
  check ((status = 'completed') = (completed_at is not null)),
  unique (goal_id, position)
);

create index development_actions_goal_idx
  on public.development_actions (goal_id, position);

create table public.development_checkins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  plan_id uuid not null,
  goal_id uuid,
  occurred_at timestamptz not null default now(),
  progress_percent smallint check (progress_percent between 0 and 100),
  note text check (note is null or length(note) <= 10000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, company_id)
    references public.development_plans(id, company_id) on delete cascade,
  foreign key (goal_id, company_id)
    references public.development_plan_goals(id, company_id) on delete restrict
);

create index development_checkins_plan_occurred_idx
  on public.development_checkins (plan_id, occurred_at desc);

-- A check-in can only point to a goal from its own plan.
create or replace function public.validate_development_checkin_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.goal_id is not null and not exists (
    select 1
    from public.development_plan_goals g
    where g.id = new.goal_id and g.plan_id = new.plan_id
  ) then
    raise exception 'goal does not belong to plan' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_development_checkin_goal() from public, anon, authenticated;

create trigger development_checkins_validate_goal
  before insert or update on public.development_checkins
  for each row execute function public.validate_development_checkin_goal();

-- -----------------------------------------------------------------------------
-- Employment-only events. Derived lifetime entries stay in their source table.
-- -----------------------------------------------------------------------------

create table public.employment_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  collaborator_id uuid not null,
  event_type text not null check (event_type in ('hired', 'role_changed', 'status_changed')),
  occurred_at timestamptz not null default now(),
  title text not null check (length(title) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 16384),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (collaborator_id, company_id)
    references public.collaborators(id, company_id) on delete cascade
);

create index employment_events_company_collaborator_idx
  on public.employment_events (company_id, collaborator_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Relationship helpers used by nested-table RLS
-- -----------------------------------------------------------------------------

create or replace function public.can_manage_review(target_review_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.performance_reviews r
    where r.id = target_review_id
      and public.can_access_collaborator(r.collaborator_id)
  );
$$;

create or replace function public.is_review_evaluator(target_review_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.review_assignments a
    where a.review_id = target_review_id
      and a.evaluator_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_assignment_evaluator(target_assignment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.review_assignments a
    where a.id = target_assignment_id
      and a.evaluator_user_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_review(target_review_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_manage_review(target_review_id)
      or public.is_review_evaluator(target_review_id);
$$;

create or replace function public.can_view_review_response(target_response_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.review_responses rr
    join public.review_assignments a on a.id = rr.assignment_id
    where rr.id = target_response_id
      and (
        public.can_manage_review(a.review_id)
        or a.evaluator_user_id = (select auth.uid())
      )
  );
$$;

create or replace function public.can_edit_review_response(target_response_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.review_responses rr
    join public.review_assignments a on a.id = rr.assignment_id
    join public.performance_reviews r on r.id = a.review_id
    where rr.id = target_response_id
      and a.evaluator_user_id = (select auth.uid())
      and a.status <> 'submitted'
      and r.status = 'open'
  );
$$;

create or replace function public.can_access_plan(target_plan_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.development_plans p
    where p.id = target_plan_id
      and public.can_access_collaborator(p.collaborator_id)
  );
$$;

create or replace function public.can_access_goal(target_goal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.development_plan_goals g
    where g.id = target_goal_id and public.can_access_plan(g.plan_id)
  );
$$;

create or replace function public.is_active_company_employee(target_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaborators c
    where c.company_id = target_company_id
      and c.auth_user_id = (select auth.uid())
      and c.access_status = 'active'
      and c.status = 'ativo'
  );
$$;

revoke all on function public.can_manage_review(uuid) from public, anon;
revoke all on function public.is_review_evaluator(uuid) from public, anon;
revoke all on function public.is_assignment_evaluator(uuid) from public, anon;
revoke all on function public.can_view_review(uuid) from public, anon;
revoke all on function public.can_view_review_response(uuid) from public, anon;
revoke all on function public.can_edit_review_response(uuid) from public, anon;
revoke all on function public.can_access_plan(uuid) from public, anon;
revoke all on function public.can_access_goal(uuid) from public, anon;
revoke all on function public.is_active_company_employee(uuid) from public, anon;
grant execute on function public.can_manage_review(uuid) to authenticated;
grant execute on function public.is_review_evaluator(uuid) to authenticated;
grant execute on function public.is_assignment_evaluator(uuid) to authenticated;
grant execute on function public.can_view_review(uuid) to authenticated;
grant execute on function public.can_view_review_response(uuid) to authenticated;
grant execute on function public.can_edit_review_response(uuid) to authenticated;
grant execute on function public.can_access_plan(uuid) to authenticated;
grant execute on function public.can_access_goal(uuid) to authenticated;
grant execute on function public.is_active_company_employee(uuid) to authenticated;

-- Enforce that a scored dimension belongs to the response's review.
create or replace function public.validate_review_response_item()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.review_responses rr
    join public.review_assignments a on a.id = rr.assignment_id
    join public.review_dimensions d on d.id = new.dimension_id
    where rr.id = new.response_id and d.review_id = a.review_id
  ) then
    raise exception 'dimension does not belong to response review' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_review_response_item() from public, anon, authenticated;

create trigger review_response_items_validate_dimension
  before insert or update on public.review_response_items
  for each row execute function public.validate_review_response_item();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.collaborator_private_profiles enable row level security;
alter table public.salary_history enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.review_dimensions enable row level security;
alter table public.review_assignments enable row level security;
alter table public.review_responses enable row level security;
alter table public.review_response_items enable row level security;
alter table public.skills enable row level security;
alter table public.collaborator_skills enable row level security;
alter table public.development_plans enable row level security;
alter table public.development_plan_goals enable row level security;
alter table public.development_actions enable row level security;
alter table public.development_checkins enable row level security;
alter table public.employment_events enable row level security;

create policy collaborator_private_profiles_select
  on public.collaborator_private_profiles for select to authenticated
  using (public.can_access_collaborator(collaborator_id));
create policy collaborator_private_profiles_insert
  on public.collaborator_private_profiles for insert to authenticated
  with check (public.can_access_collaborator(collaborator_id));
create policy collaborator_private_profiles_update
  on public.collaborator_private_profiles for update to authenticated
  using (public.can_access_collaborator(collaborator_id))
  with check (public.can_access_collaborator(collaborator_id));

create policy salary_history_select
  on public.salary_history for select to authenticated
  using (public.can_access_collaborator(collaborator_id));
create policy salary_history_insert
  on public.salary_history for insert to authenticated
  with check (public.can_access_collaborator(collaborator_id));
create policy salary_history_update
  on public.salary_history for update to authenticated
  using (public.can_access_collaborator(collaborator_id))
  with check (public.can_access_collaborator(collaborator_id));

create policy performance_reviews_select
  on public.performance_reviews for select to authenticated
  using (public.can_manage_review(id));
create policy performance_reviews_insert
  on public.performance_reviews for insert to authenticated
  with check (
    public.can_access_collaborator(collaborator_id)
    and status in ('draft', 'open')
    and overall_score is null
    and closed_at is null
  );
create policy performance_reviews_update
  on public.performance_reviews for update to authenticated
  using (public.can_manage_review(id))
  with check (public.can_access_collaborator(collaborator_id));

create policy review_dimensions_select
  on public.review_dimensions for select to authenticated
  using (public.can_view_review(review_id));
create policy review_dimensions_insert
  on public.review_dimensions for insert to authenticated
  with check (public.can_manage_review(review_id));
create policy review_dimensions_update
  on public.review_dimensions for update to authenticated
  using (public.can_manage_review(review_id))
  with check (public.can_manage_review(review_id));

create policy review_assignments_select
  on public.review_assignments for select to authenticated
  using (
    public.can_manage_review(review_id)
    or evaluator_user_id = (select auth.uid())
  );
create policy review_assignments_insert
  on public.review_assignments for insert to authenticated
  with check (public.can_manage_review(review_id));
create policy review_assignments_update
  on public.review_assignments for update to authenticated
  using (public.can_manage_review(review_id))
  with check (public.can_manage_review(review_id));

create policy review_responses_select
  on public.review_responses for select to authenticated
  using (public.can_view_review_response(id));
create policy review_responses_insert
  on public.review_responses for insert to authenticated
  with check (
    public.is_assignment_evaluator(assignment_id)
    and exists (
      select 1
      from public.review_assignments a
      join public.performance_reviews r on r.id = a.review_id
      where a.id = assignment_id and a.status <> 'submitted' and r.status = 'open'
    )
  );
create policy review_responses_update
  on public.review_responses for update to authenticated
  using (public.can_edit_review_response(id))
  with check (public.can_edit_review_response(id));

create policy review_response_items_select
  on public.review_response_items for select to authenticated
  using (public.can_view_review_response(response_id));
create policy review_response_items_insert
  on public.review_response_items for insert to authenticated
  with check (public.can_edit_review_response(response_id));
create policy review_response_items_update
  on public.review_response_items for update to authenticated
  using (public.can_edit_review_response(response_id))
  with check (public.can_edit_review_response(response_id));

create policy skills_select
  on public.skills for select to authenticated
  using (
    public.is_company_owner(company_id)
    or public.is_active_company_employee(company_id)
  );
create policy skills_insert
  on public.skills for insert to authenticated
  with check (public.is_company_owner(company_id));
create policy skills_update
  on public.skills for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy collaborator_skills_select
  on public.collaborator_skills for select to authenticated
  using (public.can_access_collaborator(collaborator_id));
create policy collaborator_skills_insert
  on public.collaborator_skills for insert to authenticated
  with check (public.can_access_collaborator(collaborator_id));
create policy collaborator_skills_update
  on public.collaborator_skills for update to authenticated
  using (public.can_access_collaborator(collaborator_id))
  with check (public.can_access_collaborator(collaborator_id));

create policy development_plans_select
  on public.development_plans for select to authenticated
  using (public.can_access_collaborator(collaborator_id));
create policy development_plans_insert
  on public.development_plans for insert to authenticated
  with check (public.can_access_collaborator(collaborator_id));
create policy development_plans_update
  on public.development_plans for update to authenticated
  using (public.can_access_collaborator(collaborator_id))
  with check (public.can_access_collaborator(collaborator_id));

create policy development_plan_goals_select
  on public.development_plan_goals for select to authenticated
  using (public.can_access_plan(plan_id));
create policy development_plan_goals_insert
  on public.development_plan_goals for insert to authenticated
  with check (public.can_access_plan(plan_id));
create policy development_plan_goals_update
  on public.development_plan_goals for update to authenticated
  using (public.can_access_plan(plan_id))
  with check (public.can_access_plan(plan_id));

create policy development_actions_select
  on public.development_actions for select to authenticated
  using (public.can_access_goal(goal_id));
create policy development_actions_insert
  on public.development_actions for insert to authenticated
  with check (public.can_access_goal(goal_id));
create policy development_actions_update
  on public.development_actions for update to authenticated
  using (public.can_access_goal(goal_id))
  with check (public.can_access_goal(goal_id));

create policy development_checkins_select
  on public.development_checkins for select to authenticated
  using (public.can_access_plan(plan_id));
create policy development_checkins_insert
  on public.development_checkins for insert to authenticated
  with check (public.can_access_plan(plan_id));

create policy employment_events_select
  on public.employment_events for select to authenticated
  using (public.can_access_collaborator(collaborator_id));
create policy employment_events_insert
  on public.employment_events for insert to authenticated
  with check (public.is_company_owner(company_id));

-- -----------------------------------------------------------------------------
-- Integrity, timestamps and write audit
-- -----------------------------------------------------------------------------

create or replace function public.validate_review_dimension_skill()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.skill_id is not null and not exists (
    select 1
    from public.performance_reviews r
    join public.skills s on s.company_id = r.company_id
    where r.id = new.review_id and s.id = new.skill_id
  ) then
    raise exception 'skill does not belong to review company' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.performance_reviews r
    where r.id = new.review_id and r.status = 'closed'
  ) then
    raise exception 'closed review structure is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function public.validate_development_goal_skill()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.skill_id is not null and not exists (
    select 1
    from public.development_plans p
    join public.skills s on s.company_id = p.company_id
    where p.id = new.plan_id and s.id = new.skill_id
  ) then
    raise exception 'skill does not belong to plan company' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_collaborator_skill_source()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.source_review_id is not null and not exists (
    select 1
    from public.performance_reviews r
    where r.id = new.source_review_id
      and r.company_id = new.company_id
      and r.collaborator_id = new.collaborator_id
  ) then
    raise exception 'source review does not belong to collaborator' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_closed_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'closed' and new is distinct from old then
    raise exception 'closed review is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- Status and calculated outcome are write-once through the close RPC. UI and
-- direct PostgREST updates cannot forge a closed review or its score.
create or replace function public.guard_performance_review_computed_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (
    (new.status is distinct from old.status and new.status = 'closed')
    or new.overall_score is distinct from old.overall_score
    or new.closed_at is distinct from old.closed_at
  ) and coalesce(current_setting('app.allow_review_close', true), '') <> 'true' then
    raise exception 'review status and calculated outcome must be changed by close RPC'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Shared provenance guard. Trigger arguments list columns that identify the
-- tenant, author or parent record and therefore cannot change after INSERT.
create or replace function public.guard_immutable_post_hire_fields()
returns trigger language plpgsql set search_path = '' as $$
declare
  immutable_column text;
begin
  foreach immutable_column in array tg_argv loop
    if (to_jsonb(new) -> immutable_column)
       is distinct from (to_jsonb(old) -> immutable_column) then
      raise exception '% is immutable on %', immutable_column, tg_table_name
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.guard_review_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  review_status text;
  review_company_id uuid;
begin
  select r.status, r.company_id
    into review_status, review_company_id
  from public.performance_reviews r
  where r.id = new.review_id;

  if review_status = 'closed' then
    raise exception 'closed review assignments are immutable' using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and old.status = 'submitted'
     and not public.is_company_owner(review_company_id) then
    raise exception 'submitted assignment must be reopened by owner' using errcode = '42501';
  end if;

  if new.status = 'submitted'
     and new.evaluator_user_id is distinct from (select auth.uid()) then
    raise exception 'only evaluator can submit assignment' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.set_created_by_from_auth()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_by := coalesce((select auth.uid()), new.created_by);
  return new;
end;
$$;

create or replace function public.set_private_profile_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create or replace function public.sync_development_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.sync_skill_unlock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'unlocked' and new.unlocked_at is null then
    new.unlocked_at := now();
  elsif new.status <> 'unlocked' then
    new.unlocked_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.audit_post_hire_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_company_id uuid;
  target_entity_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_company_id := nullif(row_data->>'company_id', '')::uuid;

  if target_company_id is null and row_data ? 'collaborator_id' then
    select c.company_id into target_company_id
    from public.collaborators c
    where c.id = (row_data->>'collaborator_id')::uuid;
  end if;

  target_entity_id := coalesce(
    nullif(row_data->>'id', '')::uuid,
    nullif(row_data->>'collaborator_id', '')::uuid
  );

  insert into public.audit_log (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    target_company_id,
    (select auth.uid()),
    'post_hire.' || tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    target_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.validate_review_dimension_skill() from public, anon, authenticated;
revoke all on function public.validate_development_goal_skill() from public, anon, authenticated;
revoke all on function public.validate_collaborator_skill_source() from public, anon, authenticated;
revoke all on function public.guard_closed_review() from public, anon, authenticated;
revoke all on function public.guard_performance_review_computed_fields() from public, anon, authenticated;
revoke all on function public.guard_immutable_post_hire_fields() from public, anon, authenticated;
revoke all on function public.guard_review_assignment() from public, anon, authenticated;
revoke all on function public.set_created_by_from_auth() from public, anon, authenticated;
revoke all on function public.set_private_profile_actor() from public, anon, authenticated;
revoke all on function public.sync_development_completion() from public, anon, authenticated;
revoke all on function public.sync_skill_unlock() from public, anon, authenticated;
revoke all on function public.audit_post_hire_write() from public, anon, authenticated;

create trigger review_dimensions_validate_skill
  before insert or update on public.review_dimensions
  for each row execute function public.validate_review_dimension_skill();
create trigger development_plan_goals_validate_skill
  before insert or update on public.development_plan_goals
  for each row execute function public.validate_development_goal_skill();
create trigger collaborator_skills_validate_source
  before insert or update on public.collaborator_skills
  for each row execute function public.validate_collaborator_skill_source();
create trigger performance_reviews_guard_closed
  before update on public.performance_reviews
  for each row execute function public.guard_closed_review();
create trigger performance_reviews_guard_computed_fields
  before update on public.performance_reviews
  for each row execute function public.guard_performance_review_computed_fields();
create trigger review_assignments_guard_state
  before insert or update on public.review_assignments
  for each row execute function public.guard_review_assignment();
create trigger development_plans_sync_completion
  before insert or update on public.development_plans
  for each row execute function public.sync_development_completion();
create trigger development_plan_goals_sync_completion
  before insert or update on public.development_plan_goals
  for each row execute function public.sync_development_completion();
create trigger development_actions_sync_completion
  before insert or update on public.development_actions
  for each row execute function public.sync_development_completion();
create trigger collaborator_skills_sync_unlock
  before insert or update on public.collaborator_skills
  for each row execute function public.sync_skill_unlock();

create trigger collaborator_private_profiles_guard_provenance
  before update on public.collaborator_private_profiles
  for each row execute function public.guard_immutable_post_hire_fields(
    'collaborator_id', 'company_id'
  );
create trigger collaborators_guard_post_hire_provenance
  before update on public.collaborators
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'company_id', 'candidate_id', 'application_id'
  );
create trigger collaborator_scores_guard_provenance
  before update on public.collaborator_scores
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id', 'actor_id'
  );
create trigger development_goals_guard_provenance
  before update on public.development_goals
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id'
  );
create trigger salary_history_guard_provenance
  before update on public.salary_history
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id', 'created_by'
  );
create trigger performance_reviews_guard_provenance
  before update on public.performance_reviews
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id', 'created_by'
  );
create trigger review_dimensions_guard_provenance
  before update on public.review_dimensions
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'review_id', 'company_id'
  );
create trigger review_assignments_guard_provenance
  before update on public.review_assignments
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'review_id', 'company_id', 'evaluator_user_id'
  );
create trigger review_responses_guard_provenance
  before update on public.review_responses
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'assignment_id', 'company_id'
  );
create trigger review_response_items_guard_provenance
  before update on public.review_response_items
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'response_id', 'dimension_id', 'company_id'
  );
create trigger skills_guard_provenance
  before update on public.skills
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'company_id'
  );
create trigger collaborator_skills_guard_provenance
  before update on public.collaborator_skills
  for each row execute function public.guard_immutable_post_hire_fields(
    'collaborator_id', 'skill_id', 'company_id', 'created_by', 'source_review_id'
  );
create trigger development_plans_guard_provenance
  before update on public.development_plans
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id', 'created_by'
  );
create trigger development_plan_goals_guard_provenance
  before update on public.development_plan_goals
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'plan_id', 'company_id'
  );
create trigger development_actions_guard_provenance
  before update on public.development_actions
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'goal_id', 'company_id'
  );
create trigger development_checkins_guard_provenance
  before update on public.development_checkins
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'plan_id', 'goal_id', 'company_id', 'created_by'
  );
create trigger employment_events_guard_provenance
  before update on public.employment_events
  for each row execute function public.guard_immutable_post_hire_fields(
    'id', 'collaborator_id', 'company_id', 'created_by'
  );

create trigger collaborator_private_profiles_set_actor
  before insert or update on public.collaborator_private_profiles
  for each row execute function public.set_private_profile_actor();

create trigger salary_history_set_created_by
  before insert on public.salary_history
  for each row execute function public.set_created_by_from_auth();
create trigger performance_reviews_set_created_by
  before insert on public.performance_reviews
  for each row execute function public.set_created_by_from_auth();
create trigger collaborator_skills_set_created_by
  before insert on public.collaborator_skills
  for each row execute function public.set_created_by_from_auth();
create trigger development_plans_set_created_by
  before insert on public.development_plans
  for each row execute function public.set_created_by_from_auth();
create trigger development_checkins_set_created_by
  before insert on public.development_checkins
  for each row execute function public.set_created_by_from_auth();
create trigger employment_events_set_created_by
  before insert on public.employment_events
  for each row execute function public.set_created_by_from_auth();

create trigger collaborator_private_profiles_set_updated_at
  before update on public.collaborator_private_profiles
  for each row execute function public.set_updated_at();
create trigger salary_history_set_updated_at
  before update on public.salary_history
  for each row execute function public.set_updated_at();
create trigger performance_reviews_set_updated_at
  before update on public.performance_reviews
  for each row execute function public.set_updated_at();
create trigger review_assignments_set_updated_at
  before update on public.review_assignments
  for each row execute function public.set_updated_at();
create trigger review_responses_set_updated_at
  before update on public.review_responses
  for each row execute function public.set_updated_at();
create trigger review_response_items_set_updated_at
  before update on public.review_response_items
  for each row execute function public.set_updated_at();
create trigger skills_set_updated_at
  before update on public.skills
  for each row execute function public.set_updated_at();
create trigger collaborator_skills_set_updated_at
  before update on public.collaborator_skills
  for each row execute function public.set_updated_at();
create trigger development_plans_set_updated_at
  before update on public.development_plans
  for each row execute function public.set_updated_at();
create trigger development_plan_goals_set_updated_at
  before update on public.development_plan_goals
  for each row execute function public.set_updated_at();
create trigger development_actions_set_updated_at
  before update on public.development_actions
  for each row execute function public.set_updated_at();
create trigger review_dimensions_set_updated_at
  before update on public.review_dimensions
  for each row execute function public.set_updated_at();
create trigger development_checkins_set_updated_at
  before update on public.development_checkins
  for each row execute function public.set_updated_at();
create trigger employment_events_set_updated_at
  before update on public.employment_events
  for each row execute function public.set_updated_at();

create trigger collaborator_private_profiles_audit
  after insert or update on public.collaborator_private_profiles
  for each row execute function public.audit_post_hire_write();
create trigger collaborators_post_hire_audit
  after update on public.collaborators
  for each row execute function public.audit_post_hire_write();
create trigger collaborator_scores_post_hire_audit
  after insert on public.collaborator_scores
  for each row execute function public.audit_post_hire_write();
create trigger development_goals_post_hire_audit
  after insert or update on public.development_goals
  for each row execute function public.audit_post_hire_write();
create trigger salary_history_audit
  after insert or update on public.salary_history
  for each row execute function public.audit_post_hire_write();
create trigger performance_reviews_audit
  after insert or update on public.performance_reviews
  for each row execute function public.audit_post_hire_write();
create trigger review_assignments_audit
  after insert or update on public.review_assignments
  for each row execute function public.audit_post_hire_write();
create trigger review_dimensions_audit
  after insert or update on public.review_dimensions
  for each row execute function public.audit_post_hire_write();
create trigger review_responses_audit
  after insert or update on public.review_responses
  for each row execute function public.audit_post_hire_write();
create trigger review_response_items_audit
  after insert or update on public.review_response_items
  for each row execute function public.audit_post_hire_write();
create trigger skills_audit
  after insert or update on public.skills
  for each row execute function public.audit_post_hire_write();
create trigger collaborator_skills_audit
  after insert or update on public.collaborator_skills
  for each row execute function public.audit_post_hire_write();
create trigger development_plans_audit
  after insert or update on public.development_plans
  for each row execute function public.audit_post_hire_write();
create trigger development_plan_goals_audit
  after insert or update on public.development_plan_goals
  for each row execute function public.audit_post_hire_write();
create trigger development_actions_audit
  after insert or update on public.development_actions
  for each row execute function public.audit_post_hire_write();
create trigger development_checkins_audit
  after insert on public.development_checkins
  for each row execute function public.audit_post_hire_write();
create trigger employment_events_audit
  after insert on public.employment_events
  for each row execute function public.audit_post_hire_write();

-- Employees do not inherit the old same-company user directory visibility.
drop policy if exists "users_select_same_company" on public.users;
create policy users_select_owner_or_self
  on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_company_owner(company_id)
  );

-- -----------------------------------------------------------------------------
-- Atomic write/read APIs
-- -----------------------------------------------------------------------------

-- Narrow evaluator context. Unlike the performance_reviews table policy, this
-- does not expose collaborator identity, summary, result or author metadata.
create or replace function public.get_review_assignment_context(target_assignment_id uuid)
returns table (
  id uuid,
  title text,
  review_date date,
  status text,
  kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.title, r.review_date, r.status, r.kind
  from public.review_assignments a
  join public.performance_reviews r on r.id = a.review_id
  where a.id = target_assignment_id
    and a.evaluator_user_id = (select auth.uid());
$$;

create or replace function public.record_salary_change(
  target_collaborator_id uuid,
  new_amount_minor bigint,
  new_effective_from date,
  new_currency text default 'BRL',
  change_reason text default null
)
returns public.salary_history
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_company_id uuid;
  created_row public.salary_history;
begin
  if not public.can_access_collaborator(target_collaborator_id) then
    raise exception 'not authorized for collaborator' using errcode = '42501';
  end if;
  if new_amount_minor < 0 or upper(new_currency) !~ '^[A-Z]{3}$' then
    raise exception 'invalid salary data' using errcode = '22023';
  end if;

  select c.company_id into target_company_id
  from public.collaborators c
  where c.id = target_collaborator_id;

  perform pg_advisory_xact_lock(hashtextextended(target_collaborator_id::text, 37));

  update public.salary_history
  set effective_to = new_effective_from
  where collaborator_id = target_collaborator_id
    and effective_from < new_effective_from
    and (effective_to is null or effective_to > new_effective_from);

  insert into public.salary_history (
    collaborator_id, company_id, amount_minor, currency,
    effective_from, reason
  ) values (
    target_collaborator_id, target_company_id, new_amount_minor, upper(new_currency),
    new_effective_from, change_reason
  )
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.submit_review_response(
  target_assignment_id uuid,
  response_items jsonb,
  response_comment text default null
)
returns public.review_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_review_id uuid;
  target_company_id uuid;
  target_response public.review_responses;
  expected_items integer;
  answered_items integer;
begin
  select a.review_id, a.company_id into target_review_id, target_company_id
  from public.review_assignments a
  join public.performance_reviews r on r.id = a.review_id
  where a.id = target_assignment_id
    and a.evaluator_user_id = (select auth.uid())
    and a.status <> 'submitted'
    and r.status = 'open'
  for update of a;

  if target_review_id is null then
    raise exception 'assignment unavailable' using errcode = '42501';
  end if;

  if jsonb_typeof(response_items) <> 'array' then
    raise exception 'response_items must be an array' using errcode = '22023';
  end if;

  insert into public.review_responses (company_id, assignment_id, overall_comment)
  values (target_company_id, target_assignment_id, nullif(trim(response_comment), ''))
  on conflict (assignment_id) do update
    set overall_comment = excluded.overall_comment
  returning * into target_response;

  delete from public.review_response_items i where i.response_id = target_response.id;

  insert into public.review_response_items (
    company_id, response_id, dimension_id, score, comment
  )
  select target_company_id, target_response.id, item.dimension_id,
         item.score, item.comment
  from jsonb_to_recordset(response_items) as item(
    dimension_id uuid,
    score numeric,
    comment text
  );

  select count(*) into expected_items
  from public.review_dimensions d
  where d.review_id = target_review_id;

  select count(*) into answered_items
  from public.review_response_items i
  join public.review_dimensions d on d.id = i.dimension_id
  where i.response_id = target_response.id
    and d.review_id = target_review_id;

  if expected_items = 0 or answered_items <> expected_items then
    raise exception 'all review dimensions must be answered' using errcode = '23514';
  end if;

  update public.review_responses
  set submitted_at = now()
  where id = target_response.id
  returning * into target_response;

  update public.review_assignments
  set status = 'submitted', submitted_at = now()
  where id = target_assignment_id;

  return target_response;
end;
$$;

create or replace function public.reopen_review_assignment(
  p_assignment_id uuid,
  p_reason text
)
returns public.review_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_company_id uuid;
  reopened_row public.review_assignments;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'reopen reason is required' using errcode = '22023';
  end if;

  select r.company_id into target_company_id
  from public.review_assignments a
  join public.performance_reviews r on r.id = a.review_id
  where a.id = p_assignment_id;

  if target_company_id is null or not public.is_company_owner(target_company_id) then
    raise exception 'only company owner can reopen assignment' using errcode = '42501';
  end if;

  update public.review_assignments
  set status = 'in_progress', submitted_at = null
  where id = p_assignment_id and status = 'submitted'
  returning * into reopened_row;

  if reopened_row.id is null then
    raise exception 'submitted assignment not found' using errcode = 'P0002';
  end if;

  update public.review_responses
  set submitted_at = null
  where assignment_id = p_assignment_id;

  insert into public.audit_log (
    company_id, actor_id, action, entity_type, entity_id, payload
  ) values (
    target_company_id, (select auth.uid()), 'post_hire.review_assignment.reopen',
    'review_assignments', p_assignment_id,
    jsonb_build_object('reason', left(trim(p_reason), 1000))
  );

  return reopened_row;
end;
$$;

create or replace function public.close_performance_review(target_review_id uuid)
returns public.performance_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_collaborator_id uuid;
  assignment_count integer;
  pending_count integer;
  calculated_score numeric(5,2);
  closed_row public.performance_reviews;
begin
  select r.collaborator_id into target_collaborator_id
  from public.performance_reviews r
  where r.id = target_review_id and r.status = 'open'
  for update;

  if target_collaborator_id is null
     or not public.can_access_collaborator(target_collaborator_id) then
    raise exception 'review unavailable' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where a.status <> 'submitted')
    into assignment_count, pending_count
  from public.review_assignments a
  where a.review_id = target_review_id;

  if assignment_count = 0 or pending_count > 0 then
    raise exception 'all assignments must be submitted before closing review'
      using errcode = '23514';
  end if;

  select round(sum(i.score * d.weight) / nullif(sum(d.weight), 0), 2)
    into calculated_score
  from public.review_response_items i
  join public.review_responses rr on rr.id = i.response_id
  join public.review_assignments a on a.id = rr.assignment_id
  join public.review_dimensions d
    on d.id = i.dimension_id and d.review_id = a.review_id
  where a.review_id = target_review_id and a.status = 'submitted';

  if calculated_score is null then
    raise exception 'review has no scored responses' using errcode = '23514';
  end if;

  perform set_config('app.allow_review_close', 'true', true);

  update public.performance_reviews
  set status = 'closed', overall_score = calculated_score, closed_at = now()
  where id = target_review_id
  returning * into closed_row;

  return closed_row;
end;
$$;

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
         coalesce(r.closed_at, r.review_date::timestamp at time zone 'UTC'),
         r.title, r.overall_score, null::bigint, null::text,
         null::uuid, null::uuid, r.id,
         jsonb_build_object('kind', r.kind, 'review_date', r.review_date)
  from public.performance_reviews r
  where r.collaborator_id = target_collaborator_id and r.status = 'closed'

  union all

  select s.id, 'salary_changed'::text,
         s.effective_from::timestamp at time zone 'UTC',
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

  ) timeline
  order by timeline.occurred_at desc, timeline.event_id desc;
end;
$$;

revoke all on function public.record_salary_change(uuid, bigint, date, text, text) from public, anon;
revoke all on function public.get_review_assignment_context(uuid) from public, anon;
revoke all on function public.submit_review_response(uuid, jsonb, text) from public, anon;
revoke all on function public.reopen_review_assignment(uuid, text) from public, anon;
revoke all on function public.close_performance_review(uuid) from public, anon;
revoke all on function public.get_collaborator_lifetime(uuid) from public, anon;
grant execute on function public.record_salary_change(uuid, bigint, date, text, text) to authenticated;
grant execute on function public.get_review_assignment_context(uuid) to authenticated;
grant execute on function public.submit_review_response(uuid, jsonb, text) to authenticated;
grant execute on function public.reopen_review_assignment(uuid, text) to authenticated;
grant execute on function public.close_performance_review(uuid) to authenticated;
grant execute on function public.get_collaborator_lifetime(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Legacy candidate tokens get a bounded lifetime during the auth transition.
-- The application must additionally reject revoked/consumed tokens.
-- -----------------------------------------------------------------------------

alter table public.applicant_tokens
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists consumed_at timestamptz;

update public.applicant_tokens
set expires_at = created_at + interval '15 minutes'
where expires_at is null;

alter table public.applicant_tokens
  alter column expires_at set default (now() + interval '15 minutes'),
  alter column expires_at set not null;

create index if not exists applicant_tokens_active_idx
  on public.applicant_tokens (token_hash, expires_at)
  where revoked_at is null and consumed_at is null;

-- -----------------------------------------------------------------------------
-- Conservative backfill. Missing facts stay missing.
-- -----------------------------------------------------------------------------

insert into public.employment_events (
  company_id, collaborator_id, event_type, occurred_at, title, metadata, created_by
)
select c.company_id, c.id, 'hired',
       c.hired_at::timestamp at time zone 'UTC',
       'Contratação',
       jsonb_build_object('role_title', c.role_title),
       null
from public.collaborators c;

insert into public.performance_reviews (
  company_id, collaborator_id, kind, title, review_date, status,
  overall_score, summary, created_by, closed_at
)
select s.company_id,
       s.collaborator_id,
       'standard',
       case
         when bool_or(s.source = 'analise_inicial') then 'Avaliação inicial'
         else 'Avaliação histórica'
       end,
       s.recorded_at::date,
       'closed',
       round(avg(s.score), 2),
       nullif(string_agg(s.note, E'\n' order by s.area) filter (where s.note is not null), ''),
       min(s.actor_id::text)::uuid,
       s.recorded_at
from public.collaborator_scores s
group by s.company_id, s.collaborator_id, s.recorded_at;

insert into public.development_plans (
  company_id, collaborator_id, title, description, status, starts_at, created_by
)
select g.company_id,
       g.collaborator_id,
       'Plano de desenvolvimento legado',
       'Metas criadas antes da nova área de desenvolvimento.',
       'active',
       min(g.created_at)::date,
       null
from public.development_goals g
group by g.company_id, g.collaborator_id;

insert into public.development_plan_goals (
  company_id, plan_id, title, description, due_date, status,
  progress_percent, completed_at, position
)
select g.company_id,
       p.id,
       g.title,
       g.description,
       g.due_date,
       case
         when g.status = 'concluida' and g.completed_at is not null then 'completed'
         when g.status = 'pausada' then 'paused'
         else 'in_progress'
       end,
       case when g.status = 'concluida' and g.completed_at is not null then 100 else 0 end,
       case when g.status = 'concluida' then g.completed_at else null end,
       (row_number() over (partition by g.collaborator_id order by g.created_at, g.id) - 1)::integer
from public.development_goals g
join public.development_plans p
  on p.collaborator_id = g.collaborator_id
 and p.company_id = g.company_id
 and p.title = 'Plano de desenvolvimento legado';

-- -----------------------------------------------------------------------------
-- Explicit client grants. RLS remains the authorization boundary.
-- -----------------------------------------------------------------------------

grant select, insert, update on public.collaborator_private_profiles to authenticated;
grant select, insert, update on public.salary_history to authenticated;
grant select, insert, update on public.performance_reviews to authenticated;
grant select, insert, update on public.review_dimensions to authenticated;
grant select, insert, update on public.review_assignments to authenticated;
grant select, insert, update on public.review_responses to authenticated;
grant select, insert, update on public.review_response_items to authenticated;
grant select, insert, update on public.skills to authenticated;
grant select, insert, update on public.collaborator_skills to authenticated;
grant select, insert, update on public.development_plans to authenticated;
grant select, insert, update on public.development_plan_goals to authenticated;
grant select, insert, update on public.development_actions to authenticated;
grant select, insert on public.development_checkins to authenticated;
grant select, insert on public.employment_events to authenticated;

commit;
