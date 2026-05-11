# Evals — Quality gate da IA

60 fixtures de candidatos sintéticos (20 candidatos × 3 perfis de empresa) usados pra detectar regressões em:

- Prompts de criação de vaga (`supabase/functions/generate-job-assets/`)
- Prompts de análise de candidato (`supabase/functions/analyze-candidate/`)

## Estrutura (populada na Sprint 4)

```
evals/
├── fixtures/
│   ├── company_dna_agency.json
│   ├── company_dna_saas_startup.json
│   ├── company_dna_industrial.json
│   └── candidates/
│       ├── 001-strong-hire-senior-dev.json
│       ├── 002-no-hire-cultural-misfit.json
│       └── ...
├── run-evals.ts        # roda IA real + LLM-as-judge
└── baseline.json       # baseline scores commitados
```

## Como funciona

1. Cada fixture = company DNA + candidato (CV + respostas do form) + gabarito esperado
2. Pipeline: candidato → análise IA → LLM-as-judge compara output vs gabarito
3. Pass: 85% das fixtures dentro da faixa esperada de score + recomendação
4. CI gate: PR que toca prompts ou edge functions de análise roda evals automaticamente

## Quando estender

- Nova fixture quando observar padrão de falha em produção
- Novo perfil de empresa quando onboardar ICP significativamente diferente

## Custo por run

Aproximadamente $15-20: 60 análises × $0.20 (Sonnet) + 60 judgments × $0.10 (Sonnet judge).
Aceitável pra um quality gate que roda algumas vezes por dia.
