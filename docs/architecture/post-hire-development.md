# Arquitetura: desenvolvimento pós-contratação

Status: aprovado para implementação  
Escopo: perfil do colaborador, avaliações, 360, skills, PDI, histórico salarial e lifetime  
Regra de acesso inicial: `owner` administra qualquer colaborador da própria empresa; a pessoa autenticada acessa e altera somente o próprio registro

## 1. Contexto e objetivo

A base atual já possui `collaborators`, `collaborator_scores` e `development_goals`, mas as policies permitem leitura e escrita para qualquer usuário autenticado do mesmo tenant. O portal do candidato também autentica por um token devolvido diretamente após informar um e-mail, sem expiração obrigatória, e consulta dados com `service_role`.

Essa combinação não pode proteger salário, endereço, data de nascimento e avaliações. A feature deve:

- manter o histórico de recrutamento ao transformar candidato em colaborador;
- vincular um usuário do Supabase Auth ao vínculo empregatício por confirmação do e-mail corporativo;
- separar dados cadastrais privados, salário, avaliações, skills e desenvolvimento;
- permitir avaliações datadas e ciclos 360;
- produzir uma timeline consistente sem duplicar os dados de origem;
- aplicar a mesma autorização no banco, independentemente da tela usada.

Ficam fora desta entrega permissões por gestor, RH, departamento e campo. O modelo preserva `company_id` e relações explícitas para que esses perfis possam ser adicionados depois.

## 2. Decisões de arquitetura

### 2.1 Identidade não é e-mail

O vínculo de autorização será `collaborators.auth_user_id -> auth.users.id`. O e-mail corporativo identifica o endereço que precisa ser confirmado, mas nunca será usado sozinho para autorizar uma consulta.

A pessoa contratada não recebe linha em `public.users`, `company_id` no JWT nem papel corporativo. Esse isolamento é obrigatório porque as policies legadas do recrutamento ainda usam `current_company_id()` e conceder esse claim abriria acesso indevido a vagas, candidaturas e análises. A autorização pós-contratação usa exclusivamente `collaborators.auth_user_id = auth.uid()` com vínculo ativo. O `owner` continua sendo resolvido por `public.users`.

Triggers nas duas tabelas, protegidos por advisory lock do usuário Auth, impedem que a mesma identidade seja gravada simultaneamente em `public.users` e `collaborators.auth_user_id`. A migration falha de forma explícita se encontrar conflito anterior que precise de resolução manual.

Regras:

- um `auth_user_id` só pode estar vinculado a um colaborador ativo no MVP;
- `corporate_email` é normalizado para minúsculas e tem unicidade por empresa entre vínculos ativos;
- alterar `corporate_email` cria um pedido pendente; a troca só é efetivada após prova de posse pelo Supabase Auth;
- desligamento rompe o vínculo `auth_user_id` e bloqueia imediatamente o acesso pós-contratação, sem apagar histórico nem destruir outros usos legítimos da identidade Auth;
- `candidate_id` e `application_id` continuam preservando a origem do recrutamento, mas não concedem acesso aos dados privados.

### 2.2 Autorização no banco

Toda tabela nova terá RLS habilitada. A condição de acesso ao colaborador será centralizada em helpers `security definer`, com `search_path = ''`, permissões restritas e uso explícito de `auth.uid()`:

```sql
public.is_company_owner(target_company_id uuid)
public.is_collaborator_self(target_collaborator_id uuid)
public.can_access_collaborator(target_collaborator_id uuid)
```

Semântica do MVP:

```text
can_access_collaborator =
  is_company_owner(company_id do colaborador)
  OR collaborator.auth_user_id = auth.uid()
```

As policies também validam que a FK apontada pertence ao mesmo `company_id`. Não basta comparar apenas o tenant recebido no payload. `owner` sempre está limitado à própria empresa.

`recruiter` e `viewer` não recebem acesso aos módulos pós-contratação nesta fase. Essa restrição substitui as policies tenant-wide existentes de colaboradores, scores e metas.

### 2.3 Dados sensíveis separados

Dados privados não ficam em `collaborators`, que permanece como registro operacional. Serão separados em tabelas próprias para reduzir exposição acidental em selects amplos e facilitar auditoria futura por domínio.

Nenhuma resposta de API retorna todos os campos por padrão. Cada tela seleciona uma projeção explícita.

### 2.4 Lifetime como projeção

Lifetime será uma projeção ordenada das fontes de verdade, não uma segunda cópia de avaliações, salários ou metas. Uma função SQL/RPC com `security invoker` unifica eventos autorizados. Eventos puramente empregatícios, como contratação, mudança de cargo e desligamento, são armazenados em `employment_events`.

Isso evita inconsistência entre uma alteração salarial e sua representação na timeline.

## 3. Modelo de dados

Todas as tabelas tenant-scoped abaixo possuem `company_id`, timestamps e índices por `(company_id, collaborator_id)` quando aplicável.

### 3.1 Vínculo e perfil privado

Alterações em `collaborators`:

| Campo | Tipo | Regra |
|---|---|---|
| `auth_user_id` | `uuid null` | FK `auth.users`, único enquanto vinculado |
| `corporate_email` | `citext null` | só muda após confirmação |
| `pending_corporate_email` | `citext null` | pedido aguardando confirmação |
| `access_status` | `text` | `pending`, `active`, `revoked` |
| `employment_ended_at` | `date null` | preenchido no desligamento |

Nova `collaborator_private_profiles` (relação 1:1):

| Campo | Tipo | Observação |
|---|---|---|
| `collaborator_id` | `uuid PK` | FK com cascade |
| `company_id` | `uuid` | defesa tenant-scoped |
| `birth_date` | `date null` | dado pessoal |
| `address` | `jsonb null` | schema validado: rua, número, complemento, cidade, UF e CEP |
| `shirt_size` | `text null` | valor curto |
| `food_preferences` | `text[]` | preferências declaradas |
| `dietary_restrictions` | `text[]` | separado de preferência |
| `personal_data` | `jsonb` | apenas campos adicionais configuráveis; não recebe salário |
| `updated_by` | `uuid` | `auth.uid()` definido no servidor |

`personal_data` é uma extensão controlada, com limite de tamanho e chaves permitidas. Não deve virar depósito de documentos ou segredos.

### 3.2 Histórico salarial

Nova `salary_history`:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `uuid` | PK |
| `collaborator_id` | `uuid` | FK |
| `company_id` | `uuid` | FK |
| `amount_minor` | `bigint` | valor em centavos; maior ou igual a zero |
| `currency` | `char(3)` | ISO 4217, padrão `BRL` |
| `effective_from` | `date` | início da vigência |
| `effective_to` | `date null` | fim exclusivo, posterior ao início |
| `reason` | `text null` | motivo da alteração |
| `created_by` | `uuid` | ator autenticado |

Não usar `float`. Um índice único em `(collaborator_id, effective_from)` impede duas mudanças na mesma data. Uma constraint/exclusion ou função transacional impede períodos sobrepostos. Atualizar uma vigência deve fechar a anterior na mesma transação.

### 3.3 Avaliações datadas

Nova `performance_reviews`:

- `id`, `company_id`, `collaborator_id`;
- `kind`: `standard` ou `360`;
- `title`, `review_date`, `period_start`, `period_end`;
- `status`: `draft`, `open`, `closed`;
- `overall_score` de 0 a 100, calculado a partir dos itens quando aplicável;
- `summary`, `created_by`, `closed_at`, `created_at`, `updated_at`.

Nova `review_dimensions`:

- catálogo versionado da avaliação: `review_id`, `skill_id` opcional, `name`, `description`, `weight`, `position`;
- a dimensão pertence ao review para que mudanças futuras no catálogo de skills não alterem avaliações antigas.

Nova `review_assignments`:

- `review_id`, `evaluator_user_id` opcional, `evaluator_email` opcional;
- `relationship`: `self`, `manager`, `peer`, `direct_report`, `other`;
- `status`: `pending`, `in_progress`, `submitted`;
- `access_token_hash` somente para convite externo futuro, com expiração e uso único;
- `submitted_at`, `created_at`;
- único por `(review_id, evaluator_user_id)` quando o avaliador já é autenticado.

Nova `review_responses`:

- uma linha por assignment, com `overall_comment`, `submitted_at`;
- respostas enviadas ficam imutáveis; somente `owner` pode reabrir uma assignment, com registro no audit log.

Nova `review_response_items`:

- `response_id`, `dimension_id`, `score` de 0 a 100 e `comment`;
- único por `(response_id, dimension_id)`.

No MVP, avaliações 360 são identificadas. O schema suporta anonimização de apresentação no futuro, mas não haverá promessa de anonimato sem regras específicas de agregação. O avaliado e o `owner` acessam o resultado consolidado; o avaliador acessa apenas a assignment atribuída e a própria resposta. A resposta individual submetida não pode ser alterada pelo avaliado.

`collaborator_scores` deixa de ser a fonte primária para novas avaliações. Uma migração converte lotes históricos em `performance_reviews` ou mantém uma view de compatibilidade até a UI migrar.

### 3.4 Skills desbloqueadas

Nova `skills`:

- `id`, `company_id`, `name`, `description`, `category`, `active`;
- nome único por empresa, com comparação case-insensitive.

Nova `collaborator_skills`:

- `collaborator_id`, `skill_id`, `company_id`;
- `level` de 1 a 5;
- `status`: `in_progress` ou `unlocked`;
- `unlocked_at`, `evidence`, `source_review_id` opcional;
- `created_by`, `updated_at`;
- PK/unique `(collaborator_id, skill_id)`.

Uma skill só aparece como desbloqueada quando `status = 'unlocked'` e `unlocked_at` não é nulo. A referência à avaliação é evidência, não autorização para alterar uma avaliação fechada.

### 3.5 PDI

Nova `development_plans`:

- `id`, `company_id`, `collaborator_id`, `title`, `description`;
- `status`: `draft`, `active`, `completed`, `cancelled`;
- `starts_at`, `target_date`, `completed_at`, `created_by`, timestamps.

Nova `development_plan_goals`:

- `plan_id`, `skill_id` opcional, `title`, `description`;
- `target_level` opcional, `success_criteria`, `due_date`;
- `status`: `not_started`, `in_progress`, `completed`, `paused`;
- `progress_percent` entre 0 e 100, `completed_at`, `position`.

Nova `development_actions`:

- `goal_id`, `title`, `description`, `kind` (`course`, `practice`, `mentoring`, `reading`, `other`);
- `due_date`, `status`, `completed_at`, `resource_url`, `position`.

Nova `development_checkins`:

- `plan_id`, `goal_id` opcional, `occurred_at`, `progress_percent`, `note`, `created_by`;
- append-only no fluxo normal, para preservar a evolução.

`development_goals` atual será migrada para um plano legado por colaborador. Depois da migração da UI, a tabela antiga fica read-only durante uma release e é removida em migration posterior.

### 3.6 Eventos de emprego e lifetime

Nova `employment_events`:

- `id`, `company_id`, `collaborator_id`;
- `event_type`: `hired`, `role_changed`, `status_changed`;
- `occurred_at`, `title`, `metadata`, `created_by`;
- append-only; correções geram novo evento de compensação.

RPC `get_collaborator_lifetime(collaborator_id)` retorna uma lista normalizada:

```text
event_id, event_type, occurred_at, title, score, amount_minor,
currency, skill_id, goal_id, source_id, metadata
```

A função combina `employment_events`, avaliações fechadas, `salary_history`, skills desbloqueadas, metas/conclusões e check-ins. Ela valida `can_access_collaborator()` antes de retornar qualquer linha. O frontend ordena por `occurred_at desc` e pode filtrar por categoria.

## 4. Matriz de RLS

| Recurso | `owner` da empresa | Própria pessoa | Outro usuário | Avaliador 360 |
|---|---|---|---|---|
| Colaborador e perfil privado | SELECT/INSERT/UPDATE | SELECT/UPDATE próprio | sem acesso | sem acesso |
| Histórico salarial | SELECT/INSERT/UPDATE | SELECT/INSERT/UPDATE próprio | sem acesso | sem acesso |
| Avaliações e dimensões | SELECT/INSERT/UPDATE | SELECT/INSERT/UPDATE próprias | sem acesso | SELECT mínimo da atribuída |
| Resposta 360 submetida | SELECT; reabertura via RPC | SELECT, sem editar resposta alheia | sem acesso | cria/edita a própria até enviar |
| Skills do colaborador | SELECT/INSERT/UPDATE | SELECT/INSERT/UPDATE próprias | sem acesso | sem acesso |
| PDI, metas, ações e check-ins | SELECT/INSERT/UPDATE | SELECT/INSERT/UPDATE próprios | sem acesso | sem acesso |
| Lifetime | SELECT | SELECT próprio | sem acesso | sem acesso |

DELETE físico não é liberado ao cliente. Cancelamento, desligamento e desativação preservam histórico. Exclusões LGPD seguem uma Edge Function administrativa separada e auditada.

Em inserts e updates, `created_by`/`updated_by` são definidos por trigger ou RPC a partir de `auth.uid()`, nunca confiados ao payload. Grants de coluna impedem que a pessoa altere `company_id`, `collaborator_id`, `auth_user_id`, status de acesso ou timestamps de auditoria.

## 5. Fluxo seguro de acesso corporativo

### 5.1 Convite inicial

1. O `owner` informa o e-mail corporativo na tela do colaborador.
2. A UI chama `invite-collaborator-access` com JWT do owner e `collaborator_id`.
3. A Edge Function valida o JWT com `auth.getUser()`, confirma role `owner`, tenant, vínculo ativo e rate limit.
4. A função cria ou localiza o usuário Auth de forma controlada, rejeita identidades já cadastradas em `public.users` e registra o vínculo como `pending` somente em `collaborators`.
5. Supabase Auth envia OTP ou magic link para o e-mail corporativo. O código/link nunca volta no JSON da API.
6. Após `verifyOtp`, a ação `activate` de `invite-collaborator-access` valida a sessão, compara o e-mail verificado com o pedido pendente e efetiva `corporate_email` e `access_status = 'active'`.
7. A sessão permanece sem `company_id` e sem papel corporativo. As policies reconhecem apenas o `auth_user_id` vinculado.

Se já existir uma identidade vinculada a outro tenant ou colaborador, a função falha sem revelar os dados conflitantes. A criação no Auth e a vinculação no banco exigem compensação idempotente porque não compartilham transação.

### 5.2 Acessos seguintes

- A pessoa solicita OTP/magic link com `signInWithOtp({ shouldCreateUser: false })`.
- Respostas são genéricas para evitar enumeração de e-mail.
- Captcha e rate limit são obrigatórios no pedido, reenvio e confirmação.
- O redirect permitido é fixo e validado; não aceitar URL arbitrária do cliente.
- A sessão usa o mecanismo do Supabase Auth. Quando houver backend/framework compatível, cookies `httpOnly` são preferidos; no Vite SPA atual, a limitação do armazenamento do SDK deve ser documentada e compensada com CSP, expiração curta e nenhuma persistência paralela de token.

### 5.3 Troca de e-mail e desligamento

Troca de e-mail repete a confirmação no novo endereço antes de substituir o vínculo. Até lá, o endereço atual continua válido.

`revoke-collaborator-access`:

- exige owner do mesmo tenant;
- marca `access_status = 'revoked'`, limpa `auth_user_id` e define `employment_ended_at` quando aplicável;
- impede novo OTP de entrar na área, mesmo que o usuário Auth continue existindo por causa do histórico de candidatura;
- registra ator, horário e motivo em `audit_log`.

### 5.4 Descontinuação do token atual

`request-candidate-access` hoje devolve um bearer token a qualquer pessoa que conheça um e-mail existente. `candidate-portal` usa `service_role` e resolve todos os dados por esse token. Esse fluxo não poderá servir `jornada` nem qualquer dado pós-contratação.

Na migração:

1. parar de retornar tokens no corpo da resposta;
2. enviar OTP/magic link pelo Supabase Auth, sempre com resposta genérica;
3. migrar a área autenticada para consultas com RLS;
4. adicionar `expires_at`, `revoked_at` e uso único aos tokens legados enquanto existirem;
5. revogar tokens legados após a janela de transição;
6. remover o acesso a scores/metas de `candidate-portal`.

Nenhuma tabela privada nova será consultada por Edge Function com `service_role` em nome de um token legado.

## 6. APIs, RPCs e Edge Functions

CRUD comum usa o cliente Supabase autenticado e RLS. Operações privilegiadas ou multi-etapa usam:

| Operação | Tipo | Responsabilidade |
|---|---|---|
| `invite-collaborator-access` | Edge Function | validar owner, provisionar Auth, enviar OTP/link e criar pendência |
| `invite-collaborator-access` (`activate`) | Edge Function autenticada | efetivar o vínculo após confirmação do e-mail |
| `revoke-collaborator-access` | Edge Function | romper o vínculo de autorização e revogar acesso |
| `record-salary-change` | RPC | fechar vigência anterior e criar a nova sem sobreposição |
| `submit-review-response` | RPC | validar assignment, gravar itens e submeter atomicamente |
| `reopen-review-assignment` | RPC owner-only | reabrir resposta e auditar motivo |
| `close-performance-review` | RPC | validar dimensões/respostas e consolidar resultado |
| `get-collaborator-lifetime` | RPC security invoker | unificar eventos autorizados |

Toda Edge Function privilegiada deve validar o bearer token do chamador; possuir uma service key não substitui autorização. Payloads usam allowlists, limites de tamanho e validação de UUID/URL/data. Erros não revelam existência de usuários ou vínculos de outro tenant.

Geração assistida de PDI por IA é opcional e posterior. Quando implementada, recebe somente avaliações que o chamador já pode ler, produz uma sugestão em `draft` e exige confirmação humana antes de salvar metas.

## 7. Migração em fases

### Fase 0: segurança e compatibilidade

- criar os helpers de autorização e testes de RLS;
- adicionar os campos de vínculo em `collaborators`, sem criar papel corporativo para a pessoa;
- substituir policies tenant-wide das tabelas atuais por owner + self;
- bloquear a jornada pós-contratação no portal por token legado;
- manter telas antigas funcionando para owner por uma view/RPC de compatibilidade.

### Fase 1: novas entidades

- criar perfil privado, salário, avaliações, skills, PDI e eventos;
- habilitar RLS antes de conceder grants;
- criar índices, constraints, triggers de auditoria e RPCs transacionais;
- atualizar tipos TypeScript gerados somente depois da migration estar fechada.

### Fase 2: backfill

- criar `employment_events.hired` a partir de `collaborators.hired_at`;
- agrupar `collaborator_scores` pela data/ator e converter cada lote em uma avaliação histórica fechada, preservando `source` e `note` em metadata;
- criar um `development_plan` legado por colaborador e mover `development_goals`;
- não inventar salário, endereço, e-mail corporativo ou data de avaliação ausente;
- executar relatórios de contagem antes/depois e guardar a reconciliação.

### Fase 3: identidade e UI

- liberar convite corporativo por owner;
- ativar área da pessoa somente após vínculo confirmado;
- migrar telas para as novas tabelas/RPCs;
- manter tabela antiga read-only por uma release.

### Fase 4: limpeza

- revogar tokens legados;
- remover endpoints e colunas de compatibilidade após verificar uso zero;
- apagar tabelas antigas apenas em migration separada e com backup validado.

As migrations são forward-only. Rollback de aplicação usa feature flag e views de compatibilidade; rollback de schema não apaga dados novos.

## 8. Auditoria, privacidade e retenção

Devem gerar `audit_log`: convite, confirmação e revogação de acesso; leitura e alteração salarial; alteração de perfil privado; fechamento/reabertura de avaliação; mudança de skill; ativação/conclusão de PDI; exportação e exclusão LGPD.

O payload de auditoria guarda IDs, campos alterados e motivo, mas não replica endereço completo, salário integral ou comentários sensíveis. Valores anteriores sensíveis devem ser mascarados ou representados por hash quando a investigação não exigir o conteúdo.

Exports, logs de aplicação, analytics e monitoramento não podem carregar salário, endereço, data de nascimento ou respostas 360.

## 9. Critérios obrigatórios de segurança e testes

Antes de liberar:

- anônimo não recebe nenhuma linha privada;
- `recruiter` e `viewer` não recebem nenhuma linha pós-contratação;
- pessoa A não lê nem altera dados da pessoa B, mesmo conhecendo UUIDs;
- owner da empresa A não acessa a empresa B;
- inserts com `company_id` ou FK cross-tenant falham;
- pessoa desligada perde acesso com sessão já aberta e em novo login;
- OTP inválido, expirado ou reutilizado falha;
- resposta 360 submetida não muda sem reabertura auditada;
- períodos salariais não se sobrepõem;
- views e RPCs não contornam RLS;
- `service_role`, `auth.admin` e chaves administrativas não aparecem em `src/`;
- `.env`, `*.pem` e `*.key` não estão versionados;
- headers de segurança e CSP são verificados antes do deploy.

Os testes de RLS devem usar quatro identidades reais: anônimo, pessoa A sem claims corporativos, pessoa B sem claims corporativos e owner, além de um owner de outro tenant. Testar SELECT, INSERT, UPDATE e DELETE em cada tabela sensível e confirmar que as pessoas não acessam nenhuma tabela do recrutamento.

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Token legado permite acesso por conhecimento do e-mail | crítico | retirar jornada do endpoint, migrar para Auth e revogar tokens |
| Policies atuais liberam todo o tenant | crítico | substituir por owner + self antes de inserir dados privados |
| E-mail reutilizado ou identidade em outro tenant | alto | autorizar por `auth_user_id`, confirmar posse e bloquear vínculo múltiplo |
| `service_role` transforma bug em vazamento global | crítico | RLS no CRUD; validação explícita nas poucas Edge Functions privilegiadas |
| Pessoa altera resposta 360 de terceiro | alto | assignment própria, imutabilidade após envio e reabertura owner-only |
| Alteração salarial perde histórico | alto | append/versionamento por vigência e RPC transacional |
| Lifetime diverge das fontes | médio | projeção via RPC, sem duplicar eventos derivados |
| Backfill inventa precisão inexistente | médio | preservar metadata original e deixar ausências como nulas |
| Sessão Auth continua viva após revogação | alto | checar `access_status` e `auth_user_id` nas policies; limpar o vínculo sem afetar candidaturas ou avaliações 360 legítimas |
| JSON de dados pessoais cresce sem controle | médio | allowlist, limite de tamanho e campos estruturados para dados frequentes |
| Futuro anonimato 360 quebra confiança | alto | MVP identificado; só prometer anonimato após regra de agregação aprovada |

## 11. Decisões adiadas

- papéis de RH, gestor, mentor e acesso por departamento;
- visibilidade campo a campo;
- avaliação 360 anônima e limiar mínimo de agregação;
- múltiplos vínculos simultâneos da mesma identidade;
- documentos pessoais e anexos;
- PDI gerado automaticamente por IA;
- faixas salariais, remuneração variável e benefícios;
- retenção específica por categoria de dado após desligamento.

Essas decisões não devem ser simuladas por condições somente no frontend. Quando aprovadas, entram como novas regras de RLS e testes de autorização.
