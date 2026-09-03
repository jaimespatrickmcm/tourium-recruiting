-- Roteiro de entrevista: as perguntas que o entrevistador faz durante a conversa
-- e o que ele registra ali na hora.
--
-- Por que existe: a etapa de entrevista era a unica sem nenhuma fonte de dado no
-- produto. A trilha do candidato mostrava "entrevista ainda nao avaliada" porque
-- de fato nao havia de onde tirar avaliacao: o que acontecia na conversa nao era
-- registrado em lugar nenhum, ficava na cabeca de quem entrevistou.
--
-- Duas tabelas, seguindo a mesma convencao de company_questions:
--   interview_questions -> o roteiro, por empresa, editavel e ordenado
--   interview_notes     -> o que foi anotado, por candidatura e por pergunta

-- Areas do scout que uma pergunta pode investigar. Mesmas seis do
-- analyze-candidate (SCOUT_AREAS), pra o roteiro nascer dentro da regua que ja
-- existe em vez de virar um documento solto ao lado dela.
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  position integer not null default 0,
  -- 'momento' e batida de roteiro (quebra-gelo, falar da vaga, abrir pra
  -- duvidas): guia a conversa mas nao produz resposta pra registrar. Sem essa
  -- distincao o entrevistador encara campos de texto vazios pra coisas que nao
  -- tem resposta, e o roteiro vira formulario chato de preencher.
  kind text not null default 'pergunta' check (kind in ('pergunta', 'momento')),
  question text not null,
  -- Perguntas de aprofundamento, mostradas como apoio embaixo da principal.
  -- "O que voce aprendeu com isso?" nao e outra pergunta: e a continuacao da
  -- pergunta sobre o maior erro, e separar as duas quebraria o fio da conversa.
  followups jsonb,
  area text check (
    area in ('cultura', 'execucao', 'comunicacao', 'raciocinio', 'motivacao', 'potencial')
  ),
  -- O que ouvir. E aqui que o roteiro deixa de ser uma lista de perguntas e vira
  -- criterio: dois entrevistadores diferentes ouvindo a mesma resposta precisam
  -- procurar a mesma coisa, senao a nota da etapa nao compara com nada.
  guidance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_questions_company_idx
  on public.interview_questions (company_id, position);

create table if not exists public.interview_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Fica null se a pergunta for apagada do roteiro depois. A anotacao sobrevive:
  -- o que a pessoa respondeu numa entrevista que ja aconteceu nao deixa de ser
  -- verdade porque alguem reescreveu o roteiro seis meses depois.
  question_id uuid references public.interview_questions(id) on delete set null,
  question_snapshot text not null,
  area text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma anotacao por pergunta por candidatura. O upsert da tela depende disso.
create unique index if not exists interview_notes_app_question_idx
  on public.interview_notes (application_id, question_id);

create index if not exists interview_notes_app_idx
  on public.interview_notes (application_id);

create trigger interview_questions_updated_at
  before update on public.interview_questions
  for each row execute function public.set_updated_at();

create trigger interview_notes_updated_at
  before update on public.interview_notes
  for each row execute function public.set_updated_at();

alter table public.interview_questions enable row level security;
alter table public.interview_notes enable row level security;

create policy "interview_questions_tenant_all"
  on public.interview_questions for all
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

create policy "interview_notes_tenant_all"
  on public.interview_notes for all
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

comment on table public.interview_questions is
  'Roteiro de entrevista por empresa. kind=momento e batida de conversa sem resposta a registrar.';
comment on table public.interview_notes is
  'O que o entrevistador anotou, por candidatura e pergunta. Sobrevive a mudanca do roteiro via question_snapshot.';
