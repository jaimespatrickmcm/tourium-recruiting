-- Currículo anexado: bucket privado + colunas na application.
-- Acesso é todo via service role (upload por signed URL, leitura por signed URL de 5min).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

alter table public.applications
  add column if not exists resume_path text,
  add column if not exists linkedin_url text;
