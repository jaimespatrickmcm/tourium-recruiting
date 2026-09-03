# Changelog

Registro de mudanças relevantes do Noren. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/).

## [0.8.0] - 2026-09-03

A jornada da pessoa continua depois da contratação.

### Added
- Página da pessoa no time virou um painel completo: visão geral, perfil privado (endereço, nascimento, preferências), salário com histórico por vigência, avaliações datadas e 360, skills com nível e evidência, lifetime e PDI com metas, ações e check-ins.
- Acesso da própria pessoa: o Admin vincula o e-mail corporativo, a pessoa confirma por magic link e entra em uma área própria (/pessoa) vendo e editando só os próprios dados. Revogação corta o acesso na hora.
- Avaliação 360 com convite por e-mail: cada participante responde só a avaliação atribuída, sem ver salário, perfil ou outras respostas.
- Primeira versão pelo agente na aba de desenvolvimento: ele lê o cargo, as respostas da candidatura e a análise, registra as skills que a pessoa demonstra (com nível e evidência) e propõe um PDI em rascunho. Nada ativa sem revisão humana.
- Botão "Usar skills da pessoa" cria as dimensões de uma avaliação a partir das skills registradas, pra acompanhar a evolução das mesmas skills ao longo do tempo.

### Changed
- Acesso do candidato às candidaturas agora chega por link no e-mail, com validade de 30 minutos. A API parou de devolver o token na resposta e responde igual pra qualquer e-mail.
- Área de time no menu e as rotas /app/time ficaram restritas ao Admin.

### Fixed
- Timeline (lifetime) quebrava ao carregar por um erro de SQL na ordenação dos eventos.
- Histórico local de migrations alinhado ao banco remoto, destravando os deploys de schema.

### Security
- Todas as tabelas novas com RLS owner + própria pessoa; salário e dados privados fora do alcance de recruiter, viewer e anônimo.
- Content-Security-Policy no deploy (Cloudflare Pages).
- Tokens legados de candidato ganharam expiração, revogação e uso único.

## [0.7.1] - 2026-08-14

Dá pra tirar alguém do time.

### Added
- Excluir colaborador na área de time, pela lixeira no card da lista ou pela zona de exclusão no fim da página da pessoa. Apaga as avaliações e as metas junto.
- Edge Function `delete-collaborator`: valida o login, confere que a pessoa é da mesma empresa (outra empresa recebe 403) e registra a exclusão no audit log.

### Changed
- O card da lista de time virou um bloco com o link em overlay, pra caber o botão de excluir sem aninhar botão dentro de link.

Análise de perfil comportamental (DISC, Big Five e Garra) como benefício da candidatura.

### Added
- Página pública `/perfil/analise`: o candidato escolhe fazer um método por vez (com explicação de cada um) ou a análise completa de uma vez, uns 15 minutos no total, só com perguntas de marcar.
- DISC com as 26 questões de ranking (toque na ordem de identificação), Big Five com 44 afirmações e Garra (Grit) com 10, na escala de 1 a 5. Pontuação calculada no servidor.
- Resultado na tela ao fim de cada método e email consolidado com tudo que já foi concluído, vinculado ao email do candidato.
- Card "Você ganhou uma análise de perfil" na tela de candidatura enviada.
- Recrutador vê o resultado no detalhe do candidato (DISC predominante com percentuais, médias do Big Five e % de garra), só pra candidatos da própria empresa.
- Consentimento explícito no início do teste; cada envio registrado no audit log.

### Changed
- O cálculo da Garra corrige a escala original de Duckworth (itens de consistência de interesse pontuam invertidos), diferente da planilha antiga que somava tudo direto.

## [0.6.0] - 2026-08-13

Application form vira etapa por convite: a candidatura termina na candidatura.

### Changed
- A tela de "candidatura enviada" não empurra mais o formulário completo. Ela agora diz o que acontece de verdade: o time avalia e, se o candidato avançar, as próximas etapas chegam por email.
- O formulário completo só abre pelo link individual do convite (enviado quando o candidato avança pra etapa de fit cultural). Acessar a URL sem convite mostra uma explicação do fluxo.
- O envio do formulário passou a validar o token do convite no servidor, igual ao prefill. O form não cria mais candidatura por conta própria.
- Capa do formulário celebra o avanço ("Você avançou no processo") e fala o tempo real, uns 15 minutos.

## [0.5.1] - 2026-08-12

### Changed
- Metadados do site atualizados pro posicionamento atual: gestão de pessoas do início ao fim (título, descrição e tags de compartilhamento). Antes falavam só de contratação.

### Removed
- Login por LinkedIn desligado por enquanto (não estava funcional). A rota antiga redireciona pro acesso por código, que segue normal. O campo de URL do LinkedIn na candidatura continua.

## [0.5.0] - 2026-08-12

Perguntas da empresa divididas em 4 categorias: sobre o candidato, cultura, curiosidade e raciocínio lógico.

### Added
- Categoria "Sobre o candidato" (profile): história, conquista, risco e falha, sonho, 3 anos e as perguntas de triagem (experiência, salário, regime, origem da vaga). No form, entra logo depois dos dados de contato, na mesma seção "Sobre você".
- Categoria "Curiosidade": mede o quanto o candidato aprende por conta própria e se aprofunda no que gosta. Base fixa com "o que você aprendeu recentemente por conta própria" e "sobre o que você fala por meia hora sem preparar".
- Pergunta fixa de cultura "Em quem você pensa quando falo em: pessoa inteligente?".
- Banco de perguntas e gerador agrupam e editam pelas 4 categorias, cada uma com seu chip.

### Changed
- Cultura fica focada em estilo de pensamento e fit (cenário do gestor, referências, pessoa inteligente, identificação com figuras públicas). Raciocínio segue puro.
- Análise rotula cada resposta pela categoria: SOBRE O CANDIDATO entra como contexto e triagem, CURIOSIDADE informa potencial e cultura.
- Ordem do form: contato, sobre você, perguntas da vaga, cultura, curiosidade, raciocínio.

## [0.4.0] - 2026-08-12

Perguntas de seleção e numéricas no application form, base Noren completa no gerador e histórico de respostas imutável.

### Added
- Formatos de pergunta no application form: aberta, numérica, escolha única e múltipla escolha. O candidato responde selects clicando nas opções (estilo Typeform, com letras A/B/C) e números num campo dedicado.
- Colunas `format` e `options` em `job_questions` e `company_questions`, expostas nas views públicas. Modais de geração, criação de vaga e banco de perguntas editam formato e opções (uma por linha).
- Método Noren completo no gerador de cultura e raciocínio: base fixa de cultura (história, conquista, risco e falha, sonho, 3 anos, cenário do gestor, referências), perguntas de triagem (anos de experiência e último salário numéricos, regime PJ/CLT, onde ficou sabendo da vaga) e raciocínio fixo (estimativa de Guarulhos, desconto composto em escolha única, barraca de limonada).
- Pergunta de calibração cultural gerada por IA ("Com qual dessas pessoas você mais se identifica?", múltipla escolha com figuras públicas de mentalidades opostas), com rubrica de fit/anti-fit calibrada pelo DNA da empresa.
- Gerador de perguntas técnicas da vaga pode propor múltipla escolha de ferramentas (ex: Canva, Figma, Illustrator, Photoshop, IA) quando a vaga tem stack claro.
- Histórico imutável por candidatura: `guidance_snapshot` e `rubric_snapshot` congelados em `application_answers` no submit. Regenerar ou editar perguntas nunca altera as respostas já enviadas nem o critério usado pra avaliá-las.

### Changed
- Análise de candidato usa o critério congelado no momento da resposta; o lookup ao vivo vira fallback só pra respostas antigas.
- Canary anti-IA agora só nas perguntas abertas (seleção e número não carregam texto copiável).

## [0.3.0] - 2026-08-11

Currículo anexado como base da análise por IA, LinkedIn opcional e copy de venda no fim da candidatura.

### Added
- Upload de currículo (PDF, até 10MB) obrigatório na candidatura, para bucket privado `resumes`. A IA extrai o texto do PDF e avalia o candidato cruzando com as exigências da vaga (não mais só o campo de motivação).
- Campo de LinkedIn opcional na candidatura, como referência para o recrutador.
- Botão "Ver currículo" no detalhe da vaga (link assinado de 5 minutos) e link do LinkedIn quando informado.
- Edge functions `create-resume-upload` (signed upload URL) e `resume-url` (link assinado para o recrutador). Colunas `applications.resume_path` e `linkedin_url`.

### Changed
- Tela de "candidatura enviada" agora explica o benefício de adiantar o application form (mais contexto para a IA, avaliação mais completa), sem número inventado.
- Prompt de análise reescrito para usar o currículo como base principal, com fallback conservador quando não há CV.

## [0.2.0] - 2026-08-11

Application form completo, acesso do candidato por token, gerador de perguntas e detecção anti-IA. Provedor de IA migrado para OpenAI GPT-5.

### Added
- Application form multi-seção (estilo Typeform): dados do candidato com cidade, perguntas técnicas por vaga e perguntas de cultura/raciocínio, uma por tela.
- Gerador de perguntas em `/app/perguntas`: wizard que gera perguntas + resposta esperada + rubrica de pontuação a partir da cultura da empresa, com opção manual. Abas Cultura, Raciocínio e Por vaga.
- Acesso do candidato por token (magic link), servido por edge functions, sem depender de OAuth. Páginas de acesso e área do candidato (candidaturas, jornada, perfil).
- Flag público/privada na criação de vaga + view `public_job_board` para o portal de vagas.
- Detecção anti-IA por canary token: instrução invisível injetada no enunciado das perguntas abertas; respostas geradas por LLM são sinalizadas com o selo "IA suspeita" no detalhe da vaga (nunca reprova sozinho).
- Tabelas: `company_questions`, `job_questions`, `application_answers`, `applicant_profiles`, `applicant_tokens`; colunas `applications.city`, `form_completed_at`, `ai_suspected`, `ai_flags` e `jobs.visibility`.

### Changed
- Provedor de IA migrado de Anthropic para OpenAI GPT-5 (secret `OPENAI_API_KEY`), com helper compartilhado `_shared/openai.ts`. Custo medido em ~$0.02 por candidato analisado.
- Candidatura simplificada agora exige telefone e a tela de sucesso leva ao application form ou ao perfil.
- Redirect do LinkedIn volta para a career page (fim do link perdido).

## [0.1.0] - 2026-08-11

Primeira versão ponta a ponta: da candidatura ao desenvolvimento do colaborador.

### Added
- Pipeline de seleção por etapas (triagem → entrevista → proposta → contratado/reprovado) com histórico de eventos por candidatura (`application_events`), avanço/reprovação com nota e ação "Contratar".
- Scoring por área na análise de IA: cada candidato recebe notas 0-100 em cultura, execução, comunicação, motivação e potencial, além do score geral, com registro da versão do DNA usada (`dimensions`, `dna_version_used`).
- Scout card (radar por área + score geral + linha de evolução) como componente central, usado no detalhe do candidato, no perfil do colaborador e no portal da pessoa.
- Módulo Time (`/app/time`): colaboradores criados na contratação (ou manualmente), avaliações periódicas por área, plano de desenvolvimento com metas e linha do tempo da pessoa.
- Portal do candidato/colaborador: "Minhas candidaturas" com progresso por etapa e "Minha jornada" com scout card, metas e linha do tempo pós-contratação.
- Tabelas novas: `application_events`, `collaborators`, `collaborator_scores`, `development_goals`, todas com RLS por tenant e visão self do candidato.
- View pública `company_public_profiles` pra career page funcionar sem login.
- Honeypot anti-bot e dedupe de candidatura (mesma vaga + mesmo e-mail) no submit público.

### Changed
- Landing page reescrita em torno da narrativa "corte até 80% do trabalho de gestão de pessoas, do recrutamento em diante".
- `analyze-candidate` passou a exigir autorização (service key ou usuário da empresa dona da candidatura) e ganhou caminho de re-análise pela UI.
- Análise pré-criada como `pending` no submit, com polling na UI e botão de re-analisar (fim do "atualize a página").
- Guards de rota por papel: sessão de candidato (LinkedIn) e de empresa (OTP) não se cruzam mais.
- Versionamento do DNA agora incrementa automaticamente quando o documento muda.
- Lista de vagas sem N+1 (contagem agregada numa query só).

### Fixed
- Career page pública quebrada por falta de leitura anônima de `companies`.
- Cálculo de custo da análise de IA errado em 1000× (sempre gravava zero).
- `candidates_self_update` sem WITH CHECK permitia reapontar a própria row.
- Candidato não conseguia ver as próprias candidaturas; empresa não conseguia ver o perfil de quem se candidatou.
- `debug-login` deixava de expor OTP em produção: agora só responde com o secret `DEBUG_LOGIN_ENABLED=true`.
