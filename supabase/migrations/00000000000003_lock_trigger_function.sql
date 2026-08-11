-- =============================================================================
-- Lock down SECURITY DEFINER trigger function from direct API calls
-- =============================================================================
-- handle_email_confirmed runs as definer (elevated privileges) to write across
-- companies + users + audit_log. By default, functions in `public` are callable
-- via PostgREST RPC. Revoke execute from anon/authenticated/public to prevent
-- direct invocation. Trigger execution is server-side internal, unaffected.

revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;
