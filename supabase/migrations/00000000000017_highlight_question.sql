-- Pergunta de destaque (screening estilo LinkedIn) escolhida por vaga.
-- Sim/Não com resposta ideal, ou texto curto. Só sinaliza, não reprova.

alter table public.jobs
  add column if not exists highlight_question text,
  add column if not exists highlight_type text check (highlight_type in ('yes_no', 'short_text')),
  add column if not exists highlight_expected text;

alter table public.applications
  add column if not exists highlight_answer text,
  add column if not exists highlight_matched boolean;
