# Plano de QA: jornada e desenvolvimento da pessoa contratada

## Objetivo

Validar a entrega de perfil pessoal, remuneração, avaliações, avaliação 360, skills, lifetime e PDI com a regra inicial de acesso:

- `owner` pode visualizar e alterar os dados de qualquer pessoa da própria empresa.
- A pessoa pode visualizar e alterar somente os próprios dados.
- `recruiter` e `viewer` não acessam os dados deste módulo, mesmo quando pertencem à mesma empresa.
- Um avaliador 360 convidado acessa somente a avaliação que lhe foi atribuída. O convite não libera perfil, salário, PDI, outras avaliações ou dados de outra pessoa.

Este plano é um portão de aceite. Falha de isolamento entre empresas, exposição de salário ou dados pessoais, acesso cruzado entre pessoas ou elevação indevida de papel é P0 e bloqueia a entrega.

## Escopo funcional

- Vinculação do e-mail corporativo à pessoa contratada.
- Autenticação por OTP ou link/token com expiração e revogação.
- Perfil pessoal e profissional, incluindo endereço, data de nascimento, tamanho de camisa e preferências alimentares.
- Salário atual e histórico salarial.
- Avaliações datadas e histórico de pontuação.
- Avaliação 360 atribuída a uma pessoa convidada.
- Skills adquiridas ou desbloqueadas.
- Lifetime com eventos de contratação, avaliação, skill, PDI e mudança salarial.
- PDI com metas, skills relacionadas, prazo, status e progresso.
- Operações de criar, ler, alterar e excluir previstas pela interface.
- Estados vazios, carregamento, sucesso, erro e conflito.
- Layout responsivo e acessibilidade.

## Ambiente e massa de teste

Usar o Supabase local reiniciado pelas migrations da branch. Não executar os testes de mutação em produção.

| Identidade | Empresa | Papel/vínculo | Finalidade |
|---|---|---|---|
| `owner-a@noren.test` | A | `owner` | Administração da empresa A |
| `pessoa-a@noren.test` | A | pessoa vinculada ao colaborador A1 | Autogestão |
| `pessoa-b@noren.test` | A | pessoa vinculada ao colaborador A2 | Teste de acesso cruzado na mesma empresa |
| `recruiter-a@noren.test` | A | `recruiter` | Negação por papel |
| `viewer-a@noren.test` | A | `viewer` | Negação por papel |
| `owner-b@noren.test` | B | `owner` | Isolamento entre empresas |
| `pessoa-c@noren.test` | B | pessoa vinculada ao colaborador B1 | Isolamento entre empresas |
| `avaliador-360@noren.test` | A ou externo, conforme modelo | somente convite 360 | Escopo mínimo do convite |
| sessão anônima | nenhuma | sem JWT | Negação padrão |

Criar para A1 e A2 dados diferentes e reconhecíveis em todas as entidades. Usar valores sentinela que deixem vazamento evidente, como salários `11111.11` e `22222.22`, endereços distintos e notas privadas distintas. Criar também um registro em outra empresa com `33333.33`.

Preparar ao menos:

- duas avaliações em datas diferentes para A1;
- uma avaliação futura inválida para teste de validação;
- duas alterações salariais para A1;
- três skills com níveis e datas diferentes;
- um PDI com duas metas e prazos distintos;
- um ciclo 360 com autoavaliação, convite pendente e resposta concluída;
- tokens válido, expirado, revogado, usado e adulterado.

## Matriz obrigatória de autorização

Executar esta matriz diretamente pela API do Supabase com o JWT de cada identidade. Ocultar botões na interface não conta como controle de acesso.

Legenda: `P` permitido, `N` negado com 401/403 ou zero linhas, `L` acesso limitado ao convite.

| Operação | Anônimo | Owner A | Pessoa A1 | Pessoa A2 | Recruiter A | Viewer A | Owner B | Avaliador 360 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ler perfil A1 | N | P | P | N | N | N | N | N |
| Alterar perfil A1 | N | P | P | N | N | N | N | N |
| Ler salário/histórico A1 | N | P | P | N | N | N | N | N |
| Alterar salário A1 | N | P | P | N | N | N | N | N |
| Ler avaliações A1 | N | P | P | N | N | N | N | N |
| Criar/alterar avaliação A1 | N | P | P | N | N | N | N | N |
| Ler skills A1 | N | P | P | N | N | N | N | N |
| Alterar skills A1 | N | P | P | N | N | N | N | N |
| Ler lifetime A1 | N | P | P | N | N | N | N | N |
| Ler/alterar PDI A1 | N | P | P | N | N | N | N | N |
| Ler convite 360 atribuído | N | P | conforme regra do ciclo | N | N | N | N | L |
| Responder convite 360 atribuído | N | P | conforme regra do ciclo | N | N | N | N | L |
| Ler outras respostas 360 | N | P | somente resultado liberado | N | N | N | N | N |

Para cada `N`, validar `SELECT`, `INSERT`, `UPDATE` e `DELETE` separadamente nas tabelas aplicáveis. Um `UPDATE` ou `DELETE` que retorna sucesso com zero linhas deve ser tratado como negado e não pode alterar o banco.

## Casos de teste de RLS e isolamento

### RLS-01: negação anônima

Sem `Authorization`, consultar e tentar mutar todas as tabelas do módulo.

Resultado esperado: nenhuma linha privada é retornada e nenhuma mutação persiste. Endpoints server-side retornam 401/403 sem detalhes de existência do registro.

### RLS-02: autogestão da pessoa

Com JWT de A1, consultar e alterar cada entidade vinculada a A1.

Resultado esperado: operações próprias permitidas, `company_id`, `collaborator_id`, `user_id`, papel e vínculo não podem ser trocados no payload.

### RLS-03: pessoa A contra pessoa B

Com JWT de A1, repetir leitura e mutação usando IDs de A2, inclusive por filtros amplos, `upsert`, relacionamento aninhado e chamada direta REST.

Resultado esperado: zero linhas ou 403. Nenhum campo, contagem, existência ou metadado de A2 é revelado.

### RLS-04: isolamento entre empresas

Com owner A e pessoa A1, usar IDs conhecidos da empresa B. Repetir com owner B contra a empresa A.

Resultado esperado: zero linhas ou 403 em todas as direções. Não é possível inserir registro com `company_id` de outra empresa.

### RLS-05: permissões do owner

Owner A executa CRUD sobre A1 e A2. Tenta repetir sobre B1.

Resultado esperado: CRUD funciona apenas na empresa A. Exclusões em cascata, se previstas, afetam somente o colaborador alvo e são registradas corretamente.

### RLS-06: recruiter e viewer

Com cada papel, abrir URLs conhecidas e chamar tabelas e funções diretamente.

Resultado esperado: nenhum dado do módulo é retornado ou alterado. A navegação não mostra atalhos. Respostas não entregam salário, dados pessoais ou IDs úteis.

### RLS-07: claims antigos e elevação de privilégio

Alterar papel no banco durante uma sessão e testar o JWT antigo. Tentar enviar `role=owner`, `company_id` e IDs de outra pessoa no corpo.

Resultado esperado: a política definida para refresh de claims é respeitada; nenhum campo do cliente eleva privilégio. Documentar se logout/refresh é necessário para aplicar redução de papel.

### RLS-08: funções com `service_role`

Inspecionar e exercitar Edge Functions que escrevem neste módulo.

Resultado esperado: cada função autentica o chamador e repete a checagem de empresa, papel, pessoa ou convite antes de usar `service_role`. Nenhuma função confia somente em IDs enviados pelo cliente.

## Autenticação, OTP e token

### AUTH-01: vínculo de e-mail corporativo

- Vincular e-mail corporativo ainda não usado à pessoa correta.
- Tentar vincular o mesmo e-mail a duas pessoas.
- Tentar vincular e-mail com caixa e espaços diferentes.
- Trocar o e-mail corporativo e verificar que o vínculo anterior perde acesso.

Resultado esperado: e-mail normalizado e único no escopo definido; colisões são recusadas sem revelar dados de outra conta; o novo vínculo requer confirmação.

### AUTH-02: solicitação de OTP

Solicitar código para e-mail existente e inexistente, em sequência rápida e após atingir limite.

Resultado esperado: resposta pública equivalente para e-mail existente e inexistente, sem enumeração de contas. Rate limit e cooldown funcionam. O código nunca aparece em log ou resposta de produção.

### AUTH-03: validação de OTP

Testar código válido, incorreto, incompleto, expirado e já usado. Tentar mais vezes que o limite e tentar usar um código emitido para outro e-mail.

Resultado esperado: apenas o código válido e dentro da validade cria sessão. Código é de uso único. Tentativas excessivas são bloqueadas temporariamente.

### AUTH-04: ciclo de vida do token/link

Testar token válido, adulterado, expirado, revogado e reutilizado. Revogar no desligamento e na troca de e-mail. Copiar o link para outro navegador.

Resultado esperado: validade e política de uso são aplicadas no servidor. Token revogado ou expirado retorna 401/403. O cliente não recebe token administrativo ou hash armazenado. Dados privados não ficam acessíveis apenas por informar um e-mail.

### AUTH-05: sessão e saída

Validar refresh, expiração, logout, múltiplas abas, remoção do vínculo e retorno pelo botão voltar.

Resultado esperado: logout e revogação impedem novas consultas; cache e estado da aplicação são limpos; não há flash de conteúdo privado durante redirecionamento.

## Dados privados e salário

### PRIV-01: exposição na rede e no bundle

Inspecionar respostas, console, source maps, estado persistido, `localStorage`, `sessionStorage`, query string e telemetria.

Resultado esperado: salário, endereço, data de nascimento, preferências e tokens aparecem somente nas respostas autorizadas necessárias. Não entram em URL, log, mensagem de erro, analytics ou bundle estático.

### PRIV-02: validação de campos pessoais

Testar campos vazios, limites máximos, caracteres internacionais, HTML/script, espaços, datas impossíveis e formatos de endereço.

Resultado esperado: validação consistente no cliente e servidor; conteúdo é renderizado como texto, sem XSS; campos opcionais podem ser removidos.

### PRIV-03: remuneração

Testar valor zero, negativo, decimal, muito alto, moeda inválida, data duplicada e evento retroativo.

Resultado esperado: somente valores e moedas aceitos persistem; histórico mantém ordenação determinística e autoria/data de mudança. Uma alteração não reescreve eventos passados.

### PRIV-04: minimização na listagem

Abrir lista de time e respostas agregadas com todos os papéis.

Resultado esperado: endpoints de lista não carregam salário e dados pessoais quando a tela não precisa deles. Recruiter e viewer não obtêm dados por agregações ou contagens laterais.

## Avaliações e avaliação 360

### EVAL-01: avaliação datada

Criar avaliação com data válida, editar notas e observação, e excluir conforme regra da interface. Testar data futura, inválida e mudança de fuso horário.

Resultado esperado: data exibida sem deslocar um dia em `America/Sao_Paulo`; notas obedecem aos limites; o histórico é ordenado pela data da avaliação com desempate estável.

### EVAL-02: evolução

Comparar gráfico, resumo e registros brutos para duas ou mais avaliações.

Resultado esperado: pontuação, variação e tendência usam a mesma regra; estado com uma avaliação não inventa tendência; ausência de dados não vira zero.

### EVAL-03: criação do ciclo 360

Criar ciclo, selecionar participantes, remover participante pendente, reenviar convite e encerrar ciclo.

Resultado esperado: convites não duplicam, somente o alvo recebe o convite e ciclo encerrado não aceita novas respostas.

### EVAL-04: escopo do avaliador convidado

Com o token do avaliador, abrir o convite correto e tentar trocar IDs no path, query, corpo e chamadas REST.

Resultado esperado: acesso limitado à avaliação atribuída. Nome e contexto exibidos seguem a decisão de produto; salário, endereço, PDI, skills privadas, outras respostas e outros ciclos nunca são retornados.

### EVAL-05: envio da resposta 360

Testar rascunho, envio completo, campos obrigatórios, nota fora do intervalo, duplo clique, duas abas e reenvio após conclusão.

Resultado esperado: envio idempotente, sem respostas duplicadas. Após conclusão, alteração só ocorre se a regra explicitamente permitir. Erros preservam o conteúdo digitado.

### EVAL-06: anonimato e resultado

Se o ciclo for anônimo, inspecionar UI, payload, exportações e erros. Se não for anônimo, validar identificação explícita.

Resultado esperado: a implementação segue uma única regra documentada. No modo anônimo, autoria e metadados correlacionáveis não chegam ao avaliado.

## Skills, lifetime e PDI

### DEV-01: skills

Criar, editar nível, marcar como desbloqueada e remover skill. Repetir nomes com caixa e espaços diferentes.

Resultado esperado: duplicidade é tratada; níveis válidos persistem; cada mudança relevante gera um evento coerente no lifetime sem duplicação.

### DEV-02: lifetime

Combinar contratação, avaliações, skills, alterações salariais e metas com datas iguais e diferentes.

Resultado esperado: ordem determinística, rótulos claros, valores corretos e filtro funcional. Eventos privados respeitam a mesma RLS da origem. Salário não vaza por descrição de evento ou endpoint agregado.

### DEV-03: PDI e metas

Criar PDI, adicionar metas, associar skills, mudar status/progresso/prazo e concluir. Testar prazo anterior ao início, progresso abaixo de 0 ou acima de 100 e remoção de skill usada.

Resultado esperado: invariantes de data e progresso validadas no servidor; timeline registra mudanças importantes; relacionamento não deixa referências órfãs.

### DEV-04: concorrência

Owner e pessoa editam o mesmo perfil, meta e avaliação em duas sessões.

Resultado esperado: comportamento de conflito é previsível. A aplicação evita perda silenciosa ou informa claramente que há versão mais recente.

## CRUD, integridade e falhas

Para cada entidade mutável, executar a sequência criar, ler, editar, recarregar, excluir e consultar novamente. Cobrir:

- falha de rede antes e depois do envio;
- duplo clique no botão de salvar;
- timeout e retry;
- payload incompleto e campos extras;
- ID inexistente e UUID inválido;
- exclusão de entidade referenciada;
- atualização simultânea;
- recarga direta na rota interna;
- rollback visual após erro.

Resultado esperado: botões ficam desabilitados durante envio, operações são idempotentes quando necessário, feedback aparece junto do problema e a UI não anuncia sucesso antes da confirmação do banco.

## Responsividade e qualidade visual

Validar as telas de lista, detalhe, formulário, gráfico/timeline, modal e avaliação 360 nas larguras 375, 768, 1024 e 1440 px.

- Não há rolagem horizontal da página em 375 px.
- Cards e grids mudam de coluna sem cortar conteúdo.
- Tabelas têm estratégia móvel clara, como cards, scroll contido ou colunas prioritárias.
- Gráficos mantêm rótulos legíveis e possuem alternativa textual ou tabela.
- Modais cabem na altura, permitem rolagem interna e não escondem ações.
- Alvos de toque têm no mínimo 44 por 44 px.
- Estados de hover não deslocam layout.
- Conteúdo assíncrono reserva espaço suficiente para evitar saltos importantes.
- Datas, moedas e notas continuam legíveis com textos longos e zoom de 200%.
- Tema claro e escuro, se ambos forem oferecidos, mantêm contraste e bordas visíveis.

## Acessibilidade

Executar navegação completa somente por teclado e uma passagem com leitor de tela.

- Ordem de tabulação acompanha a ordem visual.
- Todo controle possui nome acessível; ícones isolados têm `aria-label`.
- Inputs usam `label` associado e erros apontam o campo correspondente.
- Foco é visível e retorna ao acionador ao fechar modal.
- Tabs, dialogs, menus e OTP seguem os padrões de teclado esperados.
- Texto normal atinge contraste mínimo de 4,5:1.
- Cor não é o único indicador de nota, tendência, status ou erro.
- Gráficos oferecem resumo ou tabela equivalente.
- Alterações assíncronas importantes são anunciadas por região viva sem repetição excessiva.
- `prefers-reduced-motion` reduz animações não essenciais.
- A página funciona com zoom de 200% e reflow sem perda de operação.

Rodar um verificador automatizado, como axe, nas rotas principais, mas não considerar isso substituto da passagem manual.

## Automação recomendada

### Banco e RLS

Criar testes SQL por tabela usando claims das identidades da matriz. Os testes devem verificar tanto o resultado quanto o estado final do banco. Prioridade máxima para salário, perfil pessoal, avaliações, convites 360 e PDI.

### Integração

Testar Edge Functions com JWT real de cada papel, token inválido e corpo adulterado. Confirmar status HTTP e ausência de campos privados no JSON.

### Interface

Automatizar os caminhos críticos:

1. Owner abre A1, altera perfil, registra avaliação e atualiza salário.
2. A1 entra por OTP, vê e altera apenas os próprios dados.
3. A1 tenta abrir a URL de A2 e recebe negação sem conteúdo piscando.
4. Recruiter e viewer tentam abrir a área e não acessam dados.
5. Avaliador 360 responde apenas ao convite atribuído.
6. Sessão expira durante uma edição e a aplicação protege os dados.

## Portões de aceite

### P0, bloqueia a entrega

- Qualquer leitura ou mutação entre empresas.
- Pessoa A acessa qualquer dado de pessoa B.
- Recruiter, viewer, anônimo ou avaliador 360 acessa perfil, salário ou dados pessoais.
- Token/OTP inválido, expirado, revogado ou de outro e-mail cria sessão.
- `service_role` ou função server-side permite contornar o vínculo ou o papel.
- Segredo administrativo aparece em `src/`, bundle, log ou resposta.
- Tabela com dados do módulo sem RLS habilitada.

### P1, corrige antes da liberação geral

- CRUD perde dados, duplica eventos ou produz timeline inconsistente.
- Histórico salarial ou de avaliações calcula/ordena incorretamente.
- Convite 360 aceita resposta duplicada ou revela outra resposta.
- Fluxo principal não funciona em 375 px ou somente por teclado.
- Erro de contraste impede leitura de dados ou operação.

### P2, pode entrar em correção acompanhada

- Ajustes cosméticos sem perda funcional.
- Pequenas inconsistências de espaçamento ou microinteração.
- Texto auxiliar que pode ser mais claro sem alterar a decisão do usuário.

## Checklist final de segurança

Antes do aceite:

- [ ] Todas as tabelas novas com dados de pessoa têm RLS habilitada.
- [ ] Policies verificam vínculo da pessoa ou papel `owner` e empresa correta.
- [ ] Não existe `USING (true)` em leitura ou mutação privada.
- [ ] `recruiter` e `viewer` falham na API, não apenas na UI.
- [ ] Convite 360 valida destinatário, ciclo, estado e validade no servidor.
- [ ] OTP/token tem validade, uso/revogação e proteção contra enumeração e abuso.
- [ ] Salário e dados pessoais não entram em logs, URLs, analytics ou cache público.
- [ ] `service_role`, `SUPABASE_SERVICE_KEY`, `auth.admin.` e `supabase.auth.admin` não aparecem em `src/`.
- [ ] `.env`, `.env.local`, `*.pem` e `*.key` não estão rastreados pelo Git.
- [ ] Rotas privadas validam sessão e permissão antes de renderizar conteúdo.
- [ ] Testes críticos passam no Supabase local reiniciado do zero.
- [ ] Build e typecheck passam.
- [ ] Testes responsivos e de acessibilidade foram executados nas rotas principais.

## Evidências exigidas no relatório de QA

- Hash do commit e versão das migrations testadas.
- Resultado da matriz de autorização por identidade e operação.
- Comandos ou suíte usados nos testes de RLS.
- Capturas das larguras 375, 768, 1024 e 1440 px nas telas principais.
- Relatório automatizado de acessibilidade e observações da passagem manual.
- Evidência de token expirado/revogado e de tentativa de acesso A1 contra A2.
- Lista de defeitos com severidade, passos, resultado atual e esperado.
- Confirmação explícita de que nenhum P0 permanece aberto.
