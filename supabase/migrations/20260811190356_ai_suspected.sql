-- Detecção anti-IA (canary token): marca candidaturas cujas respostas abertas
-- contêm a palavra-canário injetada de forma invisível no enunciado.

alter table public.applications
  add column if not exists ai_suspected boolean not null default false,
  add column if not exists ai_flags jsonb;
