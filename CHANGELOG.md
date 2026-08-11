# Changelog

Registro de mudanças relevantes do Noren. Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/).

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
