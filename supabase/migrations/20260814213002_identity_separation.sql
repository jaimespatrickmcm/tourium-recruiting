-- Mantém identidades corporativas e vínculos pessoais mutuamente exclusivos.
-- O advisory lock fecha a corrida entre convite/ativação e signup corporativo.

do $$
begin
  if exists (
    select 1
    from public.users u
    join public.collaborators c on c.auth_user_id = u.id
    where c.access_status in ('pending', 'active')
  ) then
    raise exception 'resolve corporate user and collaborator identity conflicts before migration';
  end if;
end;
$$;

create or replace function public.guard_company_user_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 41));

  if exists (
    select 1
    from public.collaborators c
    where c.auth_user_id = new.id
      and c.access_status in ('pending', 'active')
  ) then
    raise exception 'identity is already linked to a collaborator'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.guard_collaborator_identity_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.auth_user_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.auth_user_id::text, 41));

  if exists (
    select 1
    from public.users u
    where u.id = new.auth_user_id
  ) then
    raise exception 'corporate user cannot be linked as collaborator identity'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_company_user_identity_separation()
  from public, anon, authenticated;
revoke all on function public.guard_collaborator_identity_separation()
  from public, anon, authenticated;

create trigger users_guard_identity_separation
  before insert or update of id on public.users
  for each row execute function public.guard_company_user_identity_separation();

create trigger collaborators_guard_identity_separation
  before insert or update of auth_user_id, access_status on public.collaborators
  for each row execute function public.guard_collaborator_identity_separation();

comment on function public.guard_company_user_identity_separation() is
  'Prevents an auth identity from being both a corporate user and a collaborator identity.';
comment on function public.guard_collaborator_identity_separation() is
  'Prevents collaborator access from inheriting corporate company_id and role claims.';
