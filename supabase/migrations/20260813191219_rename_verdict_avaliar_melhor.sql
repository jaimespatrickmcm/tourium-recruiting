-- "segurar" dizia pouco sobre o que fazer. O veredito do meio significa que o
-- candidato SEGUE no processo, mas o time precisa investigar antes de decidir.
update public.ai_analyses set stage_verdict = 'avaliar_melhor' where stage_verdict = 'segurar';
update public.application_stage_scores set stage_verdict = 'avaliar_melhor' where stage_verdict = 'segurar';

comment on column public.ai_analyses.stage_verdict is
  'Veredito da etapa: avancar, avaliar_melhor ou cortar.';
