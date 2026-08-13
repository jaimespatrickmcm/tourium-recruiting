-- Expoe SO os beneficios do DNA na view publica. Cultura, anti-fit e o resto do
-- dna_document continuam internos: o candidato nunca ve.
create or replace view public.company_public_profiles as
  select id,
         slug,
         name,
         description,
         coalesce(dna_document->'benefits', '[]'::jsonb) as benefits
  from public.companies;
