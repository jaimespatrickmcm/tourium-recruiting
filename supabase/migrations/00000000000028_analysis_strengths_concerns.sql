-- Pontos fortes e pontos de atencao, cada um com a evidencia que o sustenta.
-- E o "porque" do scout: sem isso o recrutador ve um numero e nao sabe do que
-- ele veio.
alter table public.ai_analyses add column if not exists strengths jsonb;
alter table public.ai_analyses add column if not exists concerns jsonb;

comment on column public.ai_analyses.strengths is
  'Pontos fortes: [{point, evidence}]. evidence cita o que o candidato de fato disse ou fez.';
comment on column public.ai_analyses.concerns is
  'Pontos de atencao: [{point, evidence}]. O que investigar na proxima conversa.';
