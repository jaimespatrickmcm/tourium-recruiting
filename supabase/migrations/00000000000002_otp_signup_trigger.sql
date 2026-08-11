-- =============================================================================
-- OTP signup trigger
-- =============================================================================
-- Fires when a user verifies their email (via OTP code).
-- Reads company_name + full_name from raw_user_meta_data and creates:
--   1. row in public.companies (with unique slug)
--   2. row in public.users linked to auth.users + company, with role='owner'
--   3. audit_log entry
--
-- Idempotent: skips if profile already exists.
-- If company_name is missing in metadata, leaves user without company
-- (handled later by /onboarding fallback for future OAuth flows).

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_company_name text;
  raw_full_name text;
  base_slug text;
  final_slug text;
  attempt int := 0;
  new_company_id uuid;
begin
  -- Idempotent guard
  if exists (select 1 from public.users where id = new.id) then
    return new;
  end if;

  raw_company_name := coalesce(new.raw_user_meta_data->>'company_name', '');
  raw_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  if raw_company_name = '' then
    return new;
  end if;

  -- Slug: lowercase, strip diacritics (translate covers PT/EN common cases),
  -- replace non-alphanumeric with '-', trim leading/trailing '-', cap at 36 chars.
  base_slug := lower(
    regexp_replace(
      translate(
        raw_company_name,
        'áàâãäåéèêëíìîïóòôõöúùûüýÿñçÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝŸÑÇ',
        'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'
      ),
      '[^a-zA-Z0-9]+', '-', 'g'
    )
  );
  base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
  base_slug := left(base_slug, 36);
  if base_slug = '' then
    base_slug := 'empresa';
  end if;
  final_slug := base_slug;

  -- Resolve uniqueness
  while exists (select 1 from public.companies where slug = final_slug) loop
    attempt := attempt + 1;
    final_slug := base_slug || '-' || attempt;
    if attempt > 50 then
      raise exception 'Could not generate unique company slug for "%"', raw_company_name;
    end if;
  end loop;

  -- Create company
  insert into public.companies (slug, name)
  values (final_slug, raw_company_name)
  returning id into new_company_id;

  -- Create users profile as owner
  insert into public.users (id, company_id, email, full_name, role)
  values (new.id, new_company_id, new.email, nullif(raw_full_name, ''), 'owner');

  -- Audit log
  insert into public.audit_log (company_id, actor_id, action, entity_type, entity_id, payload)
  values (
    new_company_id,
    new.id,
    'company.signup',
    'company',
    new_company_id,
    jsonb_build_object(
      'company_name', raw_company_name,
      'slug', final_slug,
      'flow', 'otp'
    )
  );

  return new;
end;
$$;

comment on function public.handle_email_confirmed is
  'Fires when auth.users.email_confirmed_at goes null → set (OTP verified). Provisions company + users profile from raw_user_meta_data.';

-- =============================================================================
-- Trigger
-- =============================================================================

drop trigger if exists on_auth_user_confirmed on auth.users;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (
    old.email_confirmed_at is distinct from new.email_confirmed_at
    and new.email_confirmed_at is not null
  )
  execute function public.handle_email_confirmed();
