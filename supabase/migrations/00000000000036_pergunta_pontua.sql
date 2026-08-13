-- Nem toda pergunta do formulário é avaliável, e as que não são estavam virando
-- nota. "Onde você ficou sabendo dessa vaga?", "Qual foi o seu último salário?",
-- "Quantos anos de experiência você tem?" e "Qual regime de contrato você
-- prefere?" são coleta de dado: não existe resposta melhor nem pior.
--
-- Sem régua pra seguir, o modelo inventava uma convenção diferente a cada
-- rodada. Medido em três análises seguidas da mesma candidata, com as mesmas
-- respostas: as quatro saíram 50, depois 100, depois 0. Como pesavam como
-- obrigatórias, sozinhas moviam o fit da etapa em 19 pontos (50 -> 69), enquanto
-- as 20 perguntas de verdade variavam 3. Era a única fonte de ruído relevante.
--
-- `scored = false` tira a pergunta da nota. A resposta continua indo pra análise
-- como CONTEXTO (salário e disponibilidade importam pra decisão), e continua
-- aparecendo pro recrutador. Ela só deixa de virar número.

alter table public.company_questions
  add column if not exists scored boolean not null default true;

alter table public.job_questions
  add column if not exists scored boolean not null default true;

comment on column public.company_questions.scored is
  'Se a resposta entra na média do fit da etapa. false = coleta de dado (salário, regime, anos de experiência, origem da vaga): vira contexto, nunca nota.';

comment on column public.job_questions.scored is
  'Se a resposta entra na média do fit da etapa. false = coleta de dado: vira contexto, nunca nota.';

-- As quatro que existem hoje. Marcadas por texto, uma a uma, de propósito:
-- não dá pra deduzir por formato nem por categoria. "Com qual dessas pessoas
-- você mais se identifica?" também é multi_select e PONTUA (é fit cultural);
-- "Um hotel ofereceu um desconto de 10%" também é single_select e PONTUA (é
-- raciocínio). O que separa é ter ou não resposta melhor, e isso é julgamento
-- humano, não regra derivável.
update public.company_questions set scored = false
where kind = 'profile'
  and (
    question ilike 'Onde você ficou sabendo dessa vaga%'
    or question ilike 'Qual foi o seu último salário%'
    or question ilike 'Quantos anos de experiência você tem%'
    or question ilike 'Qual regime de contrato você prefere%'
  );
