# Backlog do Noren

O que está combinado e ainda não foi feito. Serve pra atravessar sessão: lista
de agente não sobrevive ao fim da conversa, e a gente já perdeu item por isso.

Regra: item só sai daqui quando estiver em produção e verificado. Item bloqueado
diz **em quem** está o bloqueio.

---

## Bloqueado, esperando o Jaimes

### Roteiro de entrevista
O Jaimes tem um roteiro que usava antes e ia mandar. Sem ele, dá pra construir
metade (ver "Etapa de entrevista" abaixo), mas as perguntas clássicas dele ficam
de fora.

### Regenerar Descrição e Requisitos de duas vagas
**Head de Negócios** e **Gerente de Planejamento Estratégico**. As réguas das
perguntas dessas duas ainda pedem vocabulário em vez de competência (CAC, LTV,
payback pelo nome), então qualquer nota que a Thais e o Nicolas tirarem está
sobre régua errada.

Ordem: Descrição → Requisitos pela UI (precisa de login) → avisar → eu reescrevo
as réguas das perguntas sem tocar nos enunciados → re-analisar.

---

## Combinado, não bloqueado

### Etapa de entrevista
Objetivo do Jaimes: aprofundar os pontos que a análise deixou em aberto e
repetir algumas perguntas de outro ângulo pra pegar incoerência com o que a
pessoa escreveu no formulário.

- Roteiro sugerido a partir do contexto que já existe: `concerns` da análise,
  perguntas com nota baixa, e o gabarito da vaga. Essa parte **não** depende do
  roteiro dele.
- Pontuação **manual** por ponto do roteiro, num primeiro momento. Integração
  com ferramenta de transcrição fica pra depois.
- A nota da entrevista entra em `application_stage_scores` como mais uma etapa,
  do mesmo jeito que triagem e fit cultural.

### Linha do tempo de etapas no card do candidato
Logo abaixo do nome: etapa atual, nota de cada etapa já percorrida, próximas
etapas ofuscadas como caminho a percorrer, e as notas que levaram a pessoa até
ali. O dado já existe em `application_stage_scores` desde 13/08/2026. Quem foi
analisado antes disso tem uma linha só, então a trilha aparece curta até
re-analisar.

### Re-analisar em lote
Os 45 candidatos de Estagiário de Design têm análise antiga, de antes da nota
por pergunta, do potencial calculado, da devolutiva e das regras anti-jargão.
Hoje só dá pra re-analisar um por vez, na mão.

Testar em 2 ou 3 antes de rodar os 45: se a régua ainda for mudar, o lote é
dinheiro jogado fora.

**Cuidado:** não dá pra reprocessar reenviando o formulário. Além de exigir
token, o reenvio marca formulário concluído e promove de triagem pra fit
cultural, disparando e-mail de mudança de etapa pra 45 pessoas reais.

---

## Dívida técnica conhecida

### `ai_call_log` nunca foi criada
O CLAUDE.md define meta de custo de US$ 0,30 por candidato e p95 de latência
abaixo de 90s. Não existe nada medindo: a tabela não existe. `ai_analyses`
guarda `cost_cents` por análise, que é um começo, mas não cobre as chamadas de
geração de vaga, requisitos e perguntas.

### ESLint sem configuração
`npm run lint` quebra com "couldn't find a configuration file". O portão de lint
nunca esteve fechado.

### Colisão de numeração de migration
Existem duas `00000000000030_`: `profile_assessments` e `stage_score_history`,
criadas por sessões diferentes. Renomear uma exige combinar com quem mexe no
repo ao mesmo tempo.

### Escalas de currículo e formulário podem não ser comparáveis
Mediana da etapa de currículo é 65; a de formulário parece mais baixa. Faz
sentido, porque uma é média de rubricas e a outra é leitura holística. Com
poucas análises de formulário não dá pra calibrar as duas separado sem inventar.
Com umas 20, medir de novo antes de mexer nos cortes da escala.

---

## Dívidas conhecidas do pós-contratação (revisão de 2026-09-03)

Achados de revisão que ficaram de fora do PR da área de pessoas, por ordem de
importância. Nenhum bloqueia o dogfood com o time atual (todo mundo é confiável
e é pouca gente), mas antes de vender pra fora os três primeiros viram P1.

- **Convites sem rate limit**: `invite-collaborator-access` e
  `invite-review-assignment` não limitam frequência. O arch doc pede rate limit
  no convite; hoje um owner (ou a própria pessoa, no 360) dispara e-mails à
  vontade. Mesma pendência em `request-candidate-access`: só tem dedupe de
  1/min por e-mail, sem limite por IP nem Turnstile.
- **Magic links se atropelam**: cada `generateLink` invalida o OTP anterior do
  mesmo e-mail. Dois convites quase juntos pro mesmo avaliador deixam o
  primeiro e-mail com link morto. Redesenho: resolver o auth user por
  getUserByEmail e mandar um único link com redirect estável.
- **Persistência do agente não é atômica**: generate-development-plan grava em
  sequência (skills → plano → metas → ações) com guards e descarte do plano em
  falha parcial, mas o certo é uma RPC transacional única.
- **Corrida close vs submit na 360**: submit_review_response não trava a linha
  da review; um envio durante o close pode ficar fora do consolidado.
- **Salário retroativo**: record_salary_change não fecha o novo período quando
  há vigência posterior, e não dá pra corrigir lançamento do mesmo dia pela UI.
- **Exclusão de colaborador deixa auth user órfão**: delete_collaborator_cascade
  apaga os dados mas o usuário Auth pessoal continua existindo (LGPD).
- **Custo do agente não vai pra tabela**: costCents volta na resposta mas não há
  ai_call_log (a tabela do plano de custo nunca foi criada no projeto).
- **Mensagens cruas do Postgres em inglês** vazam em toasts de conflito
  (dimensão duplicada, avaliação já respondida, períodos sobrepostos).
- **Refetch total após cada mutação** no painel da pessoa (~15 queries); com
  volume real, migrar pra invalidação granular (TanStack Query).

---

## Perguntas abertas

- Quando o candidato vê a devolutiva do currículo: assim que sai, ou só no fim
  do processo?
- O scout deve ser comparável entre etapas, já que a etapa de currículo não tem
  perguntas e segue holística?
