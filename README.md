# Nuren

Recruiting OS contextual orientado por IA. Configure o DNA da empresa, e a IA analisa cada candidato sob essa lente específica.

## Setup local

```bash
npm install
cp .env.example .env.local
# edite .env.local com sua VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Pra rodar o stack Supabase local (Postgres + Auth + Studio + Storage):

```bash
supabase start
supabase db reset   # aplica migrations
supabase gen types typescript --local > src/types/database.ts
```

Studio local: http://localhost:54323. Inbucket (email captura local): http://localhost:54324.

## Stack

Vite + React 18 + TypeScript + Tailwind + shadcn/ui | Supabase (Postgres + Auth + Storage + Edge Functions) | Anthropic Claude | Cloudflare Pages

## Deploy

Auto-deploy via Cloudflare Pages a partir do branch `main`.

Configuração no dashboard CF Pages:
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20 (já pinado via `.nvmrc`)

Env vars de produção (Settings → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Secrets de Edge Functions (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, etc.) ficam no Supabase via `supabase secrets set KEY=value`, nunca no CF Pages.

## Documentação

Detalhes de arquitetura, decisões travadas e convenções estão em [`CLAUDE.md`](./CLAUDE.md).
