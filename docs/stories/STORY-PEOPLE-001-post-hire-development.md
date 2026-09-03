# STORY-PEOPLE-001: Jornada pós-contratação e desenvolvimento

**Status:** Ready  
**Prioridade:** Alta  
**Tipo:** Feature  
**Domínio:** Pessoas e desenvolvimento  
**Dependências:** autenticação segura, vínculo entre empresa e pessoa, autorização por empresa e identidade

## Contexto

Hoje o Noren acompanha a pessoa durante o recrutamento. Após a contratação, a empresa precisa continuar usando o mesmo perfil para registrar dados do vínculo, avaliações, evolução de competências, histórico salarial e o plano de desenvolvimento individual.

A primeira versão terá um modelo de acesso intencionalmente simples. O `owner`, tratado como Admin, poderá consultar e alterar os dados de todas as pessoas da própria empresa. A pessoa contratada poderá consultar e alterar apenas os próprios dados. Outros perfis não terão acesso. O único acesso adicional será o de um avaliador convidado para uma avaliação 360, limitado à avaliação que lhe foi atribuída.

## Objetivo

Permitir que uma pessoa contratada continue sua jornada no Noren, sem perder o histórico como candidata, e tenha um espaço seguro para acompanhar e atualizar seus dados, avaliações, competências, evolução profissional e PDI.

## Personas

### Admin da empresa (`owner`)

Responsável pela gestão de pessoas. Precisa cadastrar, consultar e alterar informações de qualquer pessoa vinculada à própria empresa, além de conduzir avaliações, acompanhar evolução e estruturar PDIs.

### Pessoa contratada

Pessoa que participou do processo seletivo e foi contratada. Precisa acessar seu perfil por uma identidade autenticada, consultar sua trajetória e manter os próprios dados atualizados.

### Avaliador 360 convidado

Pessoa convidada para responder uma avaliação específica. Pode ser um par, gestor ou outro participante. Seu acesso é restrito ao preenchimento da avaliação atribuída, sem acesso ao perfil, salário, dados pessoais, demais avaliações ou PDI do avaliado.

## História

Como Admin ou pessoa contratada, quero manter e acompanhar a jornada pós-contratação em um único perfil, para que a evolução profissional fique registrada desde o recrutamento e possa orientar avaliações e desenvolvimento.

## Escopo funcional

### 1. Conversão de candidato em pessoa contratada

- O Admin pode marcar um candidato como contratado e iniciar seu vínculo com a empresa.
- O perfil pós-contratação deve preservar a relação com o candidato, a candidatura e os dados históricos já existentes.
- A operação deve ser idempotente: repetir a ação não pode criar duas pessoas ou dois vínculos ativos para a mesma contratação.
- O vínculo deve registrar, no mínimo, empresa, pessoa, data de admissão, estado do vínculo e referência ao candidato de origem.

### 2. E-mail corporativo e acesso

- O Admin pode vincular e alterar o e-mail corporativo durante um vínculo ativo.
- O e-mail corporativo deve ser normalizado e único entre vínculos ativos quando usado como identidade de acesso.
- O vínculo do e-mail não pode criar um segundo perfil nem apagar o histórico associado ao e-mail pessoal do candidato.
- A pessoa deve comprovar a posse do e-mail corporativo por um fluxo autenticado, como magic link ou OTP com expiração e uso único.
- Informar somente o endereço de e-mail não concede acesso a dados pós-contratação.
- O acesso deve poder ser revogado quando o vínculo for encerrado ou quando o Admin substituir o e-mail corporativo.
- Após autenticação, a identidade deve ser resolvida no servidor antes da leitura ou alteração de dados.

### 3. Perfil e informações pessoais

- O perfil deve aceitar, no mínimo: endereço, data de nascimento, tamanho de camisa e preferências alimentares.
- O Admin pode consultar e alterar os dados de qualquer pessoa da própria empresa.
- A pessoa pode consultar e alterar apenas os próprios dados.
- O salário deve ser registrado como histórico, com valor, moeda, vigência e responsável pelo lançamento, sem sobrescrever períodos anteriores.
- A interface deve diferenciar dados atuais de histórico.
- Campos opcionais vazios não impedem o uso das demais áreas.

### 4. Avaliações

- Uma avaliação deve registrar pessoa avaliada, tipo, data de referência, responsável, pontuação e observações.
- O Admin pode criar, consultar e alterar avaliações de qualquer pessoa da própria empresa.
- A pessoa pode criar, consultar e alterar apenas avaliações do próprio perfil nesta primeira versão.
- O histórico deve ser cronológico e manter avaliações anteriores.
- A evolução deve permitir comparar pontuações ao longo do tempo sem perder a data e o contexto de cada avaliação.
- Uma alteração deve atualizar o registro correto, sem duplicar a avaliação ou apagar outras avaliações.

### 5. Avaliação 360

- O Admin pode criar uma avaliação 360 e convidar um ou mais avaliadores.
- Cada convite deve estar associado a uma avaliação, a um avaliador e a um estado, como pendente ou concluído.
- O avaliador convidado pode ler e alterar somente a resposta que lhe foi atribuída enquanto ela estiver aberta.
- O avaliador não pode acessar dados pessoais, salário, skills, lifetime, PDI nem outras avaliações do avaliado.
- A pessoa avaliada pode consultar o resultado consolidado dentro da regra global desta versão.
- O anonimato das respostas não faz parte desta entrega. A interface não deve prometer anonimato.
- Um convite expirado, revogado ou concluído não deve aceitar nova edição, salvo reabertura explícita pelo Admin.

### 6. Skills desbloqueadas

- O perfil deve exibir a lista de skills desbloqueadas da pessoa.
- Cada desbloqueio deve guardar skill, nível ou pontuação, data e origem ou evidência quando disponível.
- O Admin pode adicionar, alterar e remover skills de pessoas da própria empresa.
- A pessoa pode adicionar, alterar e remover apenas as próprias skills nesta primeira versão.
- A evolução da mesma skill deve ser preservada como histórico, sem apagar marcos anteriores.

### 7. Lifetime

- A aba Lifetime deve apresentar uma linha do tempo única e ordenada por data.
- A timeline deve combinar, no mínimo, contratação, avaliações, mudanças de pontuação, skills desbloqueadas, alterações salariais e marcos do PDI.
- Cada evento deve indicar data, tipo e informação necessária para compreender a mudança.
- O Admin pode consultar o lifetime de qualquer pessoa da própria empresa.
- A pessoa pode consultar apenas o próprio lifetime.
- A evolução de pontuação e salário deve ser compreensível no tempo, com representação acessível e alternativa textual ou tabular quando houver gráfico.

### 8. Desenvolvimento e PDI

- O Admin e a própria pessoa podem criar e alterar um PDI do perfil autorizado.
- O PDI deve conter objetivo, descrição, período, estado e skills relacionadas.
- Cada meta deve ter descrição clara, prazo, estado e progresso.
- A timeline de aprendizado deve registrar metas, ações, check-ins e conclusões.
- A geração assistida, quando disponível, deve produzir uma sugestão editável e exigir confirmação humana antes de persistir.
- O PDI deve se relacionar às skills que serão desenvolvidas e gerar marcos no Lifetime.

## Matriz de autorização da primeira versão

| Recurso | Admin (`owner`) | Própria pessoa | Outra pessoa | Avaliador 360 |
|---|---|---|---|---|
| Perfil e dados pessoais | Ver e alterar na própria empresa | Ver e alterar os próprios | Sem acesso | Sem acesso |
| Salário e histórico salarial | Ver e alterar na própria empresa | Ver e alterar os próprios | Sem acesso | Sem acesso |
| Avaliações | Ver e alterar na própria empresa | Ver e alterar as próprias | Sem acesso | Apenas resposta atribuída |
| Skills | Ver e alterar na própria empresa | Ver e alterar as próprias | Sem acesso | Sem acesso |
| Lifetime | Ver na própria empresa | Ver o próprio | Sem acesso | Sem acesso |
| PDI | Ver e alterar na própria empresa | Ver e alterar o próprio | Sem acesso | Sem acesso |
| Vínculo e e-mail corporativo | Ver e alterar na própria empresa | Ver o próprio | Sem acesso | Sem acesso |

Todas as regras devem ser aplicadas no banco e nas operações de servidor. Ocultar elementos na interface não é controle de acesso suficiente.

## Critérios de aceite

### Perfil e vínculo

1. Dado um candidato da empresa, quando o Admin confirmar a contratação, então um único perfil pós-contratação é criado e mantém a referência ao histórico de recrutamento.
2. Dada uma pessoa autenticada, quando ela abrir o próprio perfil, então pode consultar e alterar seus dados.
3. Dada uma pessoa autenticada, quando tentar ler ou alterar o perfil de outra pessoa, então a operação é negada no servidor ou banco.
4. Dado um Admin, quando acessar uma pessoa de outra empresa, então a operação é negada.
5. Dado um novo salário com data de vigência, quando for salvo, então o salário anterior continua disponível no histórico.

### E-mail corporativo

1. Dado um vínculo ativo, quando o Admin associar um e-mail corporativo válido, então o perfil original é preservado e o e-mail fica pendente até a comprovação de posse.
2. Dado um link ou código expirado, revogado ou já utilizado, quando alguém tentar usá-lo, então o acesso é negado.
3. Dado apenas um e-mail conhecido, quando alguém chamar o fluxo de acesso sem comprovar sua posse, então nenhum dado pessoal é retornado.
4. Dado o encerramento do vínculo, quando a revogação for concluída, então novas sessões corporativas não podem acessar a área da pessoa.

### Avaliações e 360

1. Dada uma avaliação salva, quando o histórico for aberto, então ela aparece na posição cronológica correta com sua data, pontuação e contexto.
2. Dadas duas ou mais avaliações, quando a evolução for exibida, então as pontuações permanecem associadas às respectivas datas.
3. Dado um convite 360 válido, quando o avaliador acessar, então vê somente o formulário atribuído.
4. Dado um avaliador 360, quando tentar consultar outro recurso ou outra resposta, então recebe negação de acesso.
5. Dado um convite concluído, revogado ou expirado, quando o avaliador tentar alterar a resposta, então a operação é negada.

### Skills

1. Dada uma skill desbloqueada, quando ela for registrada, então data, nível e origem ficam disponíveis no histórico.
2. Dada uma evolução de nível, quando o novo marco for salvo, então o marco anterior não é sobrescrito.
3. Dada uma pessoa autenticada, quando tentar alterar a skill de outra pessoa, então a operação é negada.

### Lifetime

1. Dados eventos de tipos diferentes, quando a aba Lifetime for aberta, então todos aparecem em ordem cronológica consistente.
2. Dadas alterações de salário e pontuação, quando a evolução for exibida, então o valor e a data de cada marco podem ser identificados sem depender apenas de cor.
3. Dado um evento pertencente a outra empresa ou pessoa, quando um usuário sem permissão tentar consultá-lo diretamente, então a operação é negada.

### PDI

1. Dado um PDI, quando Admin ou a própria pessoa adicionarem uma meta, então ela aparece com prazo, estado e skill relacionada.
2. Dado um check-in ou uma meta concluída, quando for salvo, então um marco correspondente aparece na timeline de aprendizado e no Lifetime.
3. Dada uma sugestão gerada automaticamente, quando ainda não houver confirmação humana, então ela não é considerada um PDI ativo.
4. Dada uma pessoa autenticada, quando tentar alterar o PDI de outra pessoa, então a operação é negada.

## Requisitos de UX e acessibilidade

- Seguir o sistema visual já aplicado nas telas autenticadas do projeto.
- Manter hierarquia, tipografia, espaçamento, componentes, cores e padrões de navegação existentes.
- Garantir contraste mínimo de 4,5:1 para texto normal e foco visível nos elementos interativos.
- Usar rótulos associados a todos os campos e mensagens de erro próximas ao campo correspondente.
- Garantir alvos de toque de pelo menos 44 por 44 pixels e navegação por teclado.
- Exibir estados de carregamento, vazio, erro, sucesso e ausência de permissão.
- Desabilitar ações durante o envio para evitar duplicidade.
- Garantir uso sem rolagem horizontal em 375, 768, 1024 e 1440 pixels.
- Respeitar `prefers-reduced-motion` e não usar animação como requisito para compreender alterações.
- Gráficos de evolução devem oferecer valores textuais ou tabela equivalente.
- A copy deve ser direta, humana e consistente com as outras telas, sem prometer sigilo ou anonimato não implementado.

## LGPD e segurança

- Tratar salário, endereço, data de nascimento e preferências pessoais como dados pessoais de acesso restrito.
- Preferências alimentares podem revelar dados de saúde ou religião. Devem ser opcionais, ter finalidade explícita e nunca ser inferidas automaticamente.
- Aplicar minimização: coletar apenas campos necessários e não tornar nenhum dado pessoal obrigatório sem justificativa de negócio.
- Informar a finalidade da coleta no contexto do campo e registrar a base ou política de tratamento definida pela empresa.
- Aplicar isolamento por empresa e por identidade usando RLS ou controle equivalente em todas as tabelas com dados de pessoas.
- Políticas de RLS devem verificar `auth.uid()` e papel autorizado. Não usar `USING (true)` em dados pós-contratação.
- Chaves administrativas e operações com `service_role` devem permanecer exclusivamente no servidor.
- Alterações em dados pessoais, salário, vínculo, avaliações e PDI devem ser auditáveis com autor e data.
- Logs não devem incluir salário, endereço, token, código OTP ou conteúdo completo de avaliações e PDI.
- Tokens e convites devem ser armazenados de forma segura, expirar e poder ser revogados.
- A pessoa deve ter um caminho para solicitar correção, exportação e exclusão ou anonimização conforme a política de retenção da empresa.
- Exclusão não deve quebrar obrigações legais ou a integridade de registros. Quando houver retenção obrigatória, restringir e justificar o dado mantido.
- Não expor dados pós-contratação pelo fluxo legado baseado apenas no conhecimento do e-mail.

## Fora de escopo

- Papéis adicionais para RH, gestor, departamento ou liderança.
- Permissões por campo ou por seção além de Admin e própria pessoa.
- Anonimato de respostas 360.
- Calibração, ranking ou comparação pública entre pessoas.
- Folha de pagamento, cálculo de encargos, benefícios ou integração contábil.
- Assinatura eletrônica de documentos admissionais.
- Integração automática com e-mail corporativo, diretório, HRIS ou provedor de identidade externo.
- Transcrição de feedback ou reuniões.
- Recomendações autônomas de promoção, desligamento ou remuneração.
- Aplicativo móvel nativo.

## Plano mínimo de testes

### Unitários

- Normalização e validação do e-mail corporativo.
- Ordenação da timeline e transformação dos eventos em itens de Lifetime.
- Cálculo e apresentação de séries de evolução de pontuação e salário.
- Validação de datas, moeda, metas e progresso do PDI.
- Regras de estado e expiração de convite 360.

### Integração e banco

- Admin lê e altera dados de pessoa da própria empresa.
- Admin não lê nem altera dados de outra empresa.
- Pessoa lê e altera os próprios dados.
- Pessoa não lê nem altera dados de outra pessoa.
- Usuário anônimo não lê dados pós-contratação.
- Avaliador 360 lê e altera somente a resposta atribuída e aberta.
- Convite 360 encerrado, expirado ou revogado não permite escrita.
- INSERT, UPDATE e DELETE diretos contra dados de terceiros retornam negação.
- Concorrência ou repetição na contratação não cria duplicatas.
- Alteração salarial e evolução de skills preservam registros anteriores.
- Revogação do e-mail corporativo impede acesso posterior.

### Interface e fluxo completo

- Contratar candidato, vincular e verificar e-mail corporativo, autenticar e abrir o próprio perfil.
- Criar avaliações em datas distintas e confirmar histórico e evolução.
- Registrar skill e mudança de nível, confirmando os dois marcos no Lifetime.
- Registrar mudança salarial e conferir sua aparição no histórico e Lifetime.
- Criar PDI, adicionar meta e check-in, concluir a meta e conferir as timelines.
- Criar avaliação 360, responder como convidado e validar isolamento dos demais dados.
- Verificar estados vazio, carregando, erro, acesso negado e sucesso.
- Testar teclado, foco, leitores de tela, contraste e larguras de 375, 768, 1024 e 1440 pixels.

### Segurança obrigatória antes da entrega

- Confirmar que `.env`, arquivos de chave e credenciais não estão versionados.
- Confirmar ausência de `service_role`, `SUPABASE_SERVICE_KEY`, `auth.admin.` e `supabase.auth.admin` no código cliente.
- Exercitar acesso anônimo e de usuário comum às tabelas sensíveis, esperando resposta vazia ou 401/403.
- Exercitar acesso cruzado entre empresas, esperando 401/403.
- Validar cabeçalhos de segurança da aplicação publicada.

## Definição de pronto

- Todos os critérios de aceite estão cobertos por testes proporcionais ao risco.
- Autorizações são verificadas no servidor e no banco, além da interface.
- Migrações, tipos e documentação representam o mesmo modelo de dados.
- A interface segue os padrões visuais existentes e passa pelas verificações de acessibilidade e responsividade.
- Não há regressão no processo seletivo nem perda do histórico anterior à contratação.
- O fluxo baseado apenas em e-mail não expõe dados pós-contratação.
- A revisão de segurança não possui bloqueadores P0.

