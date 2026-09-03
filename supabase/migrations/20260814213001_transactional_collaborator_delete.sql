-- Exclusão definitiva de colaborador em uma única transação.
-- Candidatura e candidato não são alvos desta função. As FKs do vínculo usam
-- ON DELETE SET NULL no sentido inverso, e os dados pós-contratação usam
-- ON DELETE CASCADE a partir de collaborators.

create or replace function public.delete_collaborator_cascade(target_collaborator_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  deleted_rows integer;
begin
  if actor_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select u.company_id
    into actor_company_id
  from public.users u
  where u.id = actor_id
    and u.role = 'owner'::public.user_role;

  if actor_company_id is null then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  -- O lock mantém a validação e a exclusão sobre a mesma versão do vínculo.
  -- O filtro pela empresa também faz um UUID cross-tenant parecer inexistente.
  perform 1
  from public.collaborators c
  where c.id = target_collaborator_id
    and c.company_id = actor_company_id
  for update;

  if not found then
    raise exception 'collaborator not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    company_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_company_id,
    actor_id,
    'collaborator.delete',
    'collaborator',
    target_collaborator_id,
    jsonb_build_object('reason', 'manual', 'cascade', true)
  );

  -- Uma única instrução destrutiva. Se qualquer cascade falhar, o audit log e
  -- a exclusão inteira sofrem rollback juntos.
  delete from public.collaborators c
  where c.id = target_collaborator_id
    and c.company_id = actor_company_id;

  get diagnostics deleted_rows = row_count;
  if deleted_rows <> 1 then
    raise exception 'collaborator delete failed' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_collaborator_cascade(uuid) from public, anon;
grant execute on function public.delete_collaborator_cascade(uuid) to authenticated;

comment on function public.delete_collaborator_cascade(uuid) is
  'Owner-only transactional deletion of a same-company collaborator and its cascaded post-hire data.';
