# Nuren — Project Context

## Product

Nuren é um Recruiting OS contextual orientado por IA. Cada empresa configura seu DNA (cultura, valores, perfil ideal, anti-fit, estilo de liderança) e a IA usa esse contexto pra gerar perguntas, analisar candidatos, ranquear e gerar reasoning.

**Repo folder:** `tourium-recruiting` (legacy working name). Produto: **Nuren**. Artefatos novos (package.json, deploys, domínio, marca) usam Nuren.

**ICP v1:** tech startups/scale-ups BR (50-300 funcionários). Decisor: founder ou head of people.

**Strategy:** dogfood-first. MCM usa Nuren internamente antes de vender externamente. Deadline pra 1º cliente pagante externo: 90 dias após launch v1.

---

## Decisões travadas (não re-debater sem reabertura explícita)

### Arquitetura

- **Multi-tenant:** JWT custom claim `company_id` via Supabase Auth Hook. RLS em toda tabela tenant-scoped. 1 user = 1 company no v1.
- **AI pipeline:** Postgres trigger → Supabase DB Webhook → Edge Function → escreve em `ai_analyses`. Retry via tabela `failed_analyses` + pg_cron. Idempotency key por `application_id`.
- **DNA versioning:** versionado (int incremental por empresa). Re-análise manual opcional. **Nunca auto re-analyze.**
- **LinkedIn scope:** "Apply with LinkedIn" OAuth apenas. **Sem** partnership Talent Solutions no v1.
- **AI eval pattern:** form estruturado + análise assíncrona pós-submit. **Sem** conversational chatbot no v1.
- **File storage:** bucket `resumes` privado. Path `{company_id}/{application_id}/{uuid}.{ext}`. 10MB, PDF/DOCX. Signed URL TTL 5min.

### Design

- **DNA Wizard:** 7 steps, 15-20 min, perguntas abertas + tags emergentes da IA. Auto-save + magic link de retomada. Desktop-first.
- **Application Form:** tempo explícito ("8-12 min"), auto-save, magic link de retomada cross-device. Apply with LinkedIn pula identificação. **Mobile-first não negociável.**
- **AI visibility:** streaming token-a-token onde fizer sentido (preview do DNA, geração de assets de vaga). Não loading invisível, mas também não animação "thinking" dramática.

### Quality

- **LGPD:** consent versioned, retenção default 12m rejeitados / 24m contratados. Soft delete + hard delete via pg_cron.
- **Eval set:** 60 fixtures (20 candidatos × 3 perfis de empresa). LLM-as-judge. PRs que tocam prompts ou edge functions de análise rodam evals em CI. Threshold 85%.
- **Anti-abuse public form:** Turnstile + rate limit IP (3 / 10min) + honeypot + MIME validation.
- **Cost monitoring:** tabela `ai_call_log`, target ≤ $0.30/candidato analisado, p95 latência < 90s.

---

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind v3 + shadcn/ui + React Router 6 + TanStack Query
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions Deno)
- **IA:** Anthropic Claude (Sonnet 4.6 análise, Haiku 4.5 parsing)
- **Embeddings:** OpenAI `text-embedding-3-large` + pgvector
- **Email:** Resend
- **Hosting:** Cloudflare Pages

---

## Commands

```bash
npm install                  # install deps (usa .npmrc legacy-peer-deps=true)
npm run dev                  # Vite dev server (porta 5173)
npm run build                # production build (dist/)
npm run typecheck            # TS check sem emit
npm run lint                 # ESLint

supabase start               # local Supabase stack (Postgres + Auth + Studio)
supabase db reset            # aplica migrations no DB local
supabase db diff -f <name>   # gerar migration a partir de mudanças locais
supabase db push             # push migrations pra remote project
supabase gen types typescript --local > src/types/database.ts
```

---

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Bugs, errors, "why is this broken" → invoke `investigate`
- Ship, deploy, push, create PR → invoke `ship`
- QA, test the site, find bugs → invoke `qa`
- Code review, check my diff → invoke `review`
- Update docs after shipping → invoke `document-release`
- Design system, brand → invoke `design-consultation`
- Visual audit, design polish → invoke `design-review`
- Architecture review of a plan → invoke `plan-eng-review`
- Save progress, checkpoint, resume → invoke `checkpoint`

---

## Hard rules

- **Sem direct push:** usar `/devops *push` ou PR via GitHub. Hook `no-direct-push` bloqueia.
- **RLS sempre:** nenhuma query nova escapa do filtro `company_id`. Toda nova tabela tenant-scoped começa com `enable row level security` + policy.
- **Service role NUNCA no client:** `service_role` e `ANTHROPIC_API_KEY` moram em Supabase secrets, jamais em `.env` do front nem em `import.meta.env`.
- **LGPD:** toda mutação que toca dados de candidato gera linha em `audit_log`.
- **Eval set é gate:** PR que toca prompt ou edge function de análise sem rodar eval set é bloqueado em CI.
- **Em-dashes (`—`) banidos em copy customer-facing** (LP, emails, microcopy do produto). Permitido em tech docs (CLAUDE.md, README, commit messages). Detalhes: `~/.claude/CLAUDE.md` global.

---

## Naming

- Arquivos: `kebab-case.ts` | Componentes: `PascalCase.tsx` | Funções: `camelCase` | Constantes: `UPPER_SNAKE_CASE`
- Imports: `@/` sempre — `import { Button } from '@/components/ui/button'`. Sem `../../`.
- Tests: co-located `*.test.tsx` (sprint 2+)

## Git

- Branches: `feature/<short-desc>` | `fix/<short-desc>` | `chore/<short-desc>`
- Commits: `type(scope): description` — `feat | fix | docs | test | refactor | chore | style | perf`

---

## Estrutura do projeto

```
src/
├── components/
│   └── ui/              # shadcn (populado via CLI: npx shadcn@latest add button)
├── pages/               # rotas (Landing, Login, App/*, Careers/*)
├── lib/
│   ├── supabase.ts      # cliente Supabase tipado
│   └── utils.ts         # cn() do shadcn + helpers
├── hooks/               # custom hooks
├── types/
│   └── database.ts      # gerado por supabase gen types
├── main.tsx             # entry point + providers
├── router.tsx           # React Router config
└── index.css            # Tailwind + shadcn CSS vars

supabase/
├── config.toml          # Supabase local config
├── migrations/          # SQL migrations
└── functions/           # Edge Functions Deno (sprint 1+)

public/
├── _redirects           # SPA fallback (CF Pages)
└── _headers             # security headers (CF Pages)

evals/                   # quality gate IA (populado sprint 4)
```
