# Noren

Recruiting OS contextual orientado por IA. Configure o DNA da empresa, e a IA analisa cada candidato sob essa lente específica.

## Quickstart local (sem nuvem)

Pré-requisitos:
- Node 20 (`.nvmrc`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) instalado
- Docker rodando (Supabase CLI usa)

```bash
# 1. Instalar deps
npm install

# 2. Subir o stack Supabase local (Postgres + Auth + Studio + Storage + Edge Runtime)
supabase start
# (saída mostra URLs e chaves — copie a anon key e a URL)

# 3. Configurar env
cp .env.example .env.local
# preencha:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<anon key do output do supabase start>

# 4. Servir as edge functions localmente
supabase functions serve

# 5. Em outro terminal, dev server do frontend
npm run dev
```

Studio local: http://localhost:54323
Inbucket (email captura local): http://localhost:54324
Frontend: http://localhost:5173

## Sprint 1 slice 1 — Auth + multi-tenant signup

Fluxo:
1. `/signup` cria conta. Backend (edge function `signup`) cria `companies` + `users` + auth user atomically com rollback.
2. Login automático após signup, redireciona pra `/app`.
3. JWT injeta `company_id` + `user_role` via Auth Hook configurado em `supabase/config.toml` (local) e no Dashboard (prod).
4. RLS em todas as tabelas tenant-scoped lê `auth.jwt()->>'company_id'`.

## Deploy em produção (Cloudflare Pages + Supabase Cloud)

### Supabase Cloud setup

1. Criar projeto em [supabase.com/dashboard](https://supabase.com/dashboard)
2. Linkar local com remote: `supabase link --project-ref <ref>`
3. Aplicar migrations: `supabase db push`
4. **Configurar Auth Hook manualmente** no Dashboard:
   - Authentication → Hooks → Custom Access Token Hook
   - Selecionar `public.custom_access_token_hook` (criada pela migration inicial)
   - Enable
5. Deploy da edge function: `supabase functions deploy signup`

### Cloudflare Pages setup

1. Conectar repo no Cloudflare Pages
2. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node version: 20 (já pinado via `.nvmrc`)
3. Environment variables (Settings → Environment Variables, Production):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Secrets de Edge Functions (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, etc.) ficam no Supabase via `supabase secrets set KEY=value`, **nunca** no CF Pages.

## Stack

Vite + React 18 + TypeScript + Tailwind + shadcn/ui | Supabase (Postgres + Auth + Storage + Edge Functions) | Anthropic Claude | Cloudflare Pages

## Documentação

Decisões de arquitetura travadas, hard rules, naming, convenções: [`CLAUDE.md`](./CLAUDE.md).
