// Edge Function: candidate-portal
// Serve a área do candidato sem sessão do Supabase Auth. O candidato manda um
// token (guardamos só o hash), resolvemos o e-mail e devolvemos somente dados
// do recrutamento: candidaturas e perfil. Dados pós-contratação exigem uma
// sessão autenticada e nunca passam por este endpoint.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = {
  token?: string;
  action?: 'get' | 'update_profile';
  payload?: {
    full_name?: string;
    phone?: string;
    city?: string;
    linkedin_url?: string;
    about?: string;
  };
};

const MAX_FIELD = 500;
const MAX_ABOUT = 3000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const token = (body.token ?? '').trim();
  const action = body.action ?? 'get';
  if (!token) return jsonResponse({ error: 'Token faltando' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve o e-mail a partir do hash do token.
  const tokenHash = await sha256Hex(token);
  const { data: tokenRow, error: tokenError } = await admin
    .from('applicant_tokens')
    .select('id, email, expires_at, revoked_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  const expiresAt = tokenRow?.expires_at ? new Date(tokenRow.expires_at).getTime() : Number.NaN;
  // consumed_at hoje nunca é preenchido (o token é multiuso dentro do TTL de
  // 30min, senão o refresh da página derrubaria a sessão do candidato), mas a
  // checagem honra o contrato do schema: se alguém marcar, o token morre.
  if (
    tokenError ||
    !tokenRow ||
    tokenRow.revoked_at ||
    tokenRow.consumed_at ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return jsonResponse({ error: 'Acesso inválido ou expirado' }, 401);
  }

  const email = tokenRow.email as string;

  // Marca uso do token (best-effort, não bloqueia a resposta).
  await admin
    .from('applicant_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  if (action === 'update_profile') {
    const updates: Record<string, string | null> = {};
    const p = body.payload ?? {};
    if ('full_name' in p) updates.full_name = clean(p.full_name, MAX_FIELD);
    if ('phone' in p) updates.phone = clean(p.phone, MAX_FIELD);
    if ('city' in p) updates.city = clean(p.city, MAX_FIELD);
    if ('linkedin_url' in p) updates.linkedin_url = clean(p.linkedin_url, MAX_FIELD);
    if ('about' in p) updates.about = clean(p.about, MAX_ABOUT);

    const { data: updated, error: updateError } = await admin
      .from('applicant_profiles')
      .update(updates)
      .eq('email', email)
      .select('email, full_name, phone, city, linkedin_url, picture_url, about')
      .maybeSingle();

    if (updateError || !updated) {
      return jsonResponse({ error: 'Não conseguimos salvar seu perfil agora.' }, 500);
    }
    return jsonResponse({ ok: true, profile: updated });
  }

  // action === 'get'
  const { data: profile } = await admin
    .from('applicant_profiles')
    .select('email, full_name, phone, city, linkedin_url, picture_url, about')
    .eq('email', email)
    .maybeSingle();

  const { data: appRows } = await admin
    .from('applications')
    .select('id, job_id, company_id, status, created_at, form_completed_at')
    .eq('candidate_email', email)
    .order('created_at', { ascending: false });

  // Devolutiva do currículo: a ÚNICA parte da análise que o candidato pode ver.
  // Pega a mais recente entre as candidaturas dele. O resto da análise (nota,
  // veredito, dimensões) é interno da empresa e não sai daqui.
  let cvFeedback: unknown = null;
  if (appRows && appRows.length > 0) {
    const { data: fb } = await admin
      .from('ai_analyses')
      .select('cv_feedback, ran_at')
      .in(
        'application_id',
        appRows.map((a) => a.id as string),
      )
      .eq('status', 'completed')
      .not('cv_feedback', 'is', null)
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cvFeedback = fb?.cv_feedback ?? null;
  }

  const applications: Array<Record<string, unknown>> = [];

  if (appRows && appRows.length > 0) {
    const appIds = appRows.map((a) => a.id as string);
    const jobIds = [...new Set(appRows.map((a) => a.job_id as string))];
    const companyIds = [...new Set(appRows.map((a) => a.company_id as string))];

    const [jobsRes, companiesRes, eventsRes] = await Promise.all([
      admin.from('jobs').select('id, title, slug').in('id', jobIds),
      admin.from('companies').select('id, name, slug').in('id', companyIds),
      admin
        .from('application_events')
        .select('application_id, type, from_status, to_status, created_at')
        .in('application_id', appIds)
        .eq('type', 'stage_change')
        .order('created_at', { ascending: true }),
    ]);

    const jobs = new Map<string, { title: string; slug: string }>();
    for (const j of jobsRes.data ?? []) {
      jobs.set(j.id as string, { title: j.title as string, slug: j.slug as string });
    }
    const companies = new Map<string, { name: string; slug: string }>();
    for (const c of companiesRes.data ?? []) {
      companies.set(c.id as string, { name: c.name as string, slug: c.slug as string });
    }
    const eventsByApp = new Map<string, Array<Record<string, unknown>>>();
    for (const e of eventsRes.data ?? []) {
      const key = e.application_id as string;
      const list = eventsByApp.get(key) ?? [];
      list.push({
        from_status: e.from_status,
        to_status: e.to_status,
        created_at: e.created_at,
      });
      eventsByApp.set(key, list);
    }

    for (const a of appRows) {
      const job = jobs.get(a.job_id as string) ?? null;
      const company = companies.get(a.company_id as string) ?? null;
      applications.push({
        id: a.id,
        status: a.status,
        created_at: a.created_at,
        form_completed_at: a.form_completed_at ?? null,
        jobTitle: job?.title ?? 'Vaga encerrada',
        companyName: company?.name ?? null,
        companySlug: company?.slug ?? null,
        jobSlug: job?.slug ?? null,
        events: eventsByApp.get(a.id as string) ?? [],
      });
    }
  }

  return jsonResponse({
    ok: true,
    profile: { ...(profile ?? { email }), cv_feedback: cvFeedback },
    applications,
  });
});
