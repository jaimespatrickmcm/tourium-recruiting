-- =============================================================================
-- Fix: restore SELECT/UPDATE grants on public.users to authenticated
-- =============================================================================
-- Migration 0000 revoked all privileges on public.users from authenticated
-- to give exclusivity to supabase_auth_admin (for the Auth Hook). That
-- accidentally broke the authenticated user's ability to read their own row.
-- RLS still filters which row(s) they can see — but they need basic table
-- permission first.

grant select on public.users to authenticated;
grant update on public.users to authenticated;

-- Keep INSERT/DELETE restricted to service_role (trigger handles user creation)

-- Also ensure auth_admin keeps its access for the Auth Hook function (if active)
grant select (id, company_id, role) on public.users to supabase_auth_admin;
