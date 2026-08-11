-- =============================================================================
-- Make current_company_id() resilient to missing JWT claim
-- =============================================================================
-- Previously: read company_id from JWT only. If Auth Hook isn't active, returns
-- null, RLS filters return zero rows, app breaks with "Conta sem empresa vinculada".
--
-- Now: try JWT claim first (fast path when Hook is active), fall back to
-- querying public.users by auth.uid() (works without any Hook config).
-- SECURITY DEFINER bypasses RLS on the public.users lookup (no recursion).

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'company_id', '')::uuid,
    (select company_id from public.users where id = (select auth.uid()))
  );
$$;

-- Same idea for current_user_role
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'user_role', ''),
    (select role::text from public.users where id = (select auth.uid()))
  );
$$;

comment on function public.current_company_id is 'Returns the company_id for the current user. Prefers JWT claim (when Auth Hook is active), falls back to public.users lookup.';
comment on function public.current_user_role is 'Returns the role for the current user. Prefers JWT claim (when Auth Hook is active), falls back to public.users lookup.';

-- Re-lock execute permissions (definer-elevated, only callable via RLS evaluation)
revoke execute on function public.current_company_id() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;

-- Allow authenticated to call them inside RLS expressions
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
