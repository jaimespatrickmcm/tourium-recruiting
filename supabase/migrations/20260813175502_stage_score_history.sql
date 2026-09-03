-- Historico das notas por etapa. ai_analyses guarda so a analise VIGENTE (a
-- re-analise sobrescreve), entao a nota da triagem se perdia quando o candidato
-- avancava pro fit cultural. Sem isso nao da pra responder depois a pergunta que
-- interessa: quem virou bom funcionario tirou quanto em cada etapa?
create table if not exists public.application_stage_scores (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  evidence_stage text not null,
  stage_score integer,
  stage_verdict text,
  score integer,
  dimensions jsonb,
  stage_dimensions jsonb,
  question_scores jsonb,
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists application_stage_scores_app_idx
  on public.application_stage_scores (application_id, created_at desc);
create index if not exists application_stage_scores_company_idx
  on public.application_stage_scores (company_id);

alter table public.application_stage_scores enable row level security;

-- Mesma regra das outras tabelas tenant-scoped: so a empresa dona enxerga.
create policy "stage scores da propria empresa"
  on public.application_stage_scores for select
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);

comment on table public.application_stage_scores is
  'Log append-only da nota de cada etapa. Preserva o historico que ai_analyses sobrescreve na re-analise.';
