-- Análise de perfil comportamental (DISC, Big Five, GRIT) vinculada ao
-- candidato pelo email, cross-empresa. O candidato faz o teste como benefício
-- da candidatura; o resultado fica no perfil dele e visível pras empresas em
-- que ele se candidatou. Consentimento registrado por linha (LGPD).

create table public.profile_assessments (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  method text not null check (method in ('disc', 'bigfive', 'grit')),
  answers jsonb not null,
  result jsonb not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index profile_assessments_email_idx
  on public.profile_assessments (lower(email), method, created_at desc);

alter table public.profile_assessments enable row level security;

-- Escrita só via edge function (service role). Leitura: usuário de empresa
-- enxerga os testes de quem se candidatou a alguma vaga da empresa dele.
create policy profile_assessments_company_read on public.profile_assessments
  for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where lower(a.candidate_email) = lower(profile_assessments.email)
        and a.company_id = public.current_company_id()
    )
  );
