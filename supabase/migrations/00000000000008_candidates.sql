-- =============================================================================
-- Candidate-side auth and profile
-- =============================================================================
-- Adds the "candidato" side of the platform: people que aplicam a vagas.
-- Linked a auth.users via FK. Login via LinkedIn OAuth (provider='linkedin_oidc').

create table public.candidates (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  picture_url text,
  linkedin_url text,
  linkedin_sub text,
  about text,
  cv_file_path text,
  cv_extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_email_idx on public.candidates (email);
create index candidates_linkedin_sub_idx on public.candidates (linkedin_sub);

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS: candidato gerencia o próprio perfil
-- =============================================================================

alter table public.candidates enable row level security;

create policy "candidates_self_select"
  on public.candidates
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "candidates_self_update"
  on public.candidates
  for update
  to authenticated
  using (id = (select auth.uid()));

create policy "candidates_self_insert"
  on public.candidates
  for insert
  to authenticated
  with check (id = (select auth.uid()));

grant select, insert, update on public.candidates to authenticated;

-- =============================================================================
-- Link applications a candidates (opcional — denormalized fields ficam)
-- =============================================================================

alter table public.applications
  add column candidate_id uuid references public.candidates(id) on delete set null;

create index applications_candidate_id_idx on public.applications (candidate_id);

-- =============================================================================
-- Trigger: cria candidates row automaticamente em OAuth LinkedIn signup
-- =============================================================================

create or replace function public.handle_candidate_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_full_name text;
  raw_picture text;
  raw_sub text;
begin
  -- Idempotência
  if exists (select 1 from public.candidates where id = new.id) then
    return new;
  end if;

  raw_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name'
  );
  raw_picture := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );
  raw_sub := new.raw_user_meta_data->>'provider_id';

  insert into public.candidates (id, email, full_name, picture_url, linkedin_sub)
  values (new.id, new.email, raw_full_name, raw_picture, raw_sub);

  return new;
end;
$$;

revoke execute on function public.handle_candidate_signup() from public, anon, authenticated;

comment on function public.handle_candidate_signup is
  'Fires AFTER INSERT on auth.users when provider=linkedin_oidc. Cria row em public.candidates a partir do user_metadata.';

drop trigger if exists on_candidate_oauth_signup on auth.users;

create trigger on_candidate_oauth_signup
  after insert on auth.users
  for each row
  when (new.raw_app_meta_data->>'provider' = 'linkedin_oidc')
  execute function public.handle_candidate_signup();
