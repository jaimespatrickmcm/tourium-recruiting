-- Potencial deixa de ser palpite e vira projecao calculada. Guardamos os
-- COMPONENTES separados, nao so o numero final: quando houver dado real de
-- desempenho de quem foi contratado, da pra recalibrar os pesos sem
-- re-analisar ninguem.
alter table public.ai_analyses add column if not exists potential_breakdown jsonb;

-- Sinal de lideranca fica FORA da nota, de proposito. Se virasse area do scout,
-- especialista otimo que nao quer liderar apareceria pior, e alguem usaria isso
-- como desempate numa vaga que nao pede lideranca.
alter table public.ai_analyses add column if not exists leadership_signal jsonb;

comment on column public.ai_analyses.potential_breakdown is
  'Componentes do potencial: {aquisicao, trajetoria, reflexao, raciocinio} cada um {score, evidence}. O numero final e calculado no codigo.';
comment on column public.ai_analyses.leadership_signal is
  'Sinal de lideranca: {level: sem|moderado|forte, evidence: [], intent: alto|medio|baixo|nao_declarado, intent_evidence}. Nunca entra em media.';
