# Changelog

Registro de mudanças relevantes do Noren. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/).

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
