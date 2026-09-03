-- role_title entra na lista de campos que a própria pessoa não altera.
-- O cargo alimenta o prompt do agente de desenvolvimento, os eventos de
-- emprego e a leitura do owner sobre o registro: é dado do vínculo, não
-- dado pessoal. Owner e service_role seguem podendo alterar.

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
    or new.role_title is distinct from old.role_title
  ) then
    raise exception 'employee cannot change protected employment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
