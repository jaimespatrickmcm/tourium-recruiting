-- Observações do currículo (legível pelo recrutador): resumo factual em PT-BR
-- do que o CV mostra (experiência, fatos relevantes, link de portfólio).
-- Nullable: fica null quando não há texto de currículo.

alter table public.ai_analyses
  add column if not exists cv_observations text;
