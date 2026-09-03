// Edge Function: request-candidate-access
// Endpoint público. Se o e-mail tiver candidatura, envia um link de acesso.
// A resposta é sempre genérica para não revelar quais e-mails estão cadastrados.
// O token nunca é devolvido à UI nem registrado em texto puro.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmail, sendEmail } from '../_shared/email.ts';

type Payload = { email?: string };

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

function generateToken(): string {
  // Dois UUIDs + entropia extra via getRandomValues. Bem mais que suficiente.
  const extra = new Uint8Array(16);
  crypto.getRandomValues(extra);
  const extraHex = Array.from(extra)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${crypto.randomUUID()}${crypto.randomUUID()}${extraHex}`.replace(/-/g, '');
}

function genericSuccess() {
  return jsonResponse({
    ok: true,
    message: 'Se existir uma candidatura com esse e-mail, você receberá um link de acesso.',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const email = (payload.email ?? '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResponse({ error: 'E-mail inválido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicAppUrl = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '');
  if (!supabaseUrl || !serviceRoleKey || !/^https?:\/\//.test(publicAppUrl)) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Existe candidatura com esse e-mail? Pegamos a mais recente pra preencher o perfil.
  const { data: apps, error: appsError } = await admin
    .from('applications')
    .select('candidate_name, candidate_phone, city, created_at')
    .eq('candidate_email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (appsError) {
    console.error('request-candidate-access applications lookup failed', appsError.message);
    return genericSuccess();
  }

  if (!apps || apps.length === 0) {
    return genericSuccess();
  }

  const latest = apps[0] as {
    candidate_name: string | null;
    candidate_phone: string | null;
    city: string | null;
  };

  // Upsert do perfil: cria se não existe, e preenche full_name/phone/city que
  // ainda estiverem vazios a partir da candidatura mais recente.
  const { data: existing } = await admin
    .from('applicant_profiles')
    .select('email, full_name, phone, city')
    .eq('email', email)
    .maybeSingle();

  const profileRow = {
    email,
    full_name: existing?.full_name ?? latest.candidate_name ?? null,
    phone: existing?.phone ?? latest.candidate_phone ?? null,
    city: existing?.city ?? latest.city ?? null,
  };

  const { error: upsertError } = await admin
    .from('applicant_profiles')
    .upsert(profileRow, { onConflict: 'email' });
  if (upsertError) {
    console.error('request-candidate-access profile upsert failed', upsertError.message);
    return genericSuccess();
  }

  // Evita disparos repetidos em sequência. A resposta continua igual.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentToken } = await admin
    .from('applicant_tokens')
    .select('id')
    .eq('email', email)
    .is('revoked_at', null)
    .gte('created_at', oneMinuteAgo)
    .limit(1)
    .maybeSingle();
  if (recentToken) return genericSuccess();

  // Gera token com validade curta e guarda só o hash.
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const { data: insertedToken, error: tokenError } = await admin
    .from('applicant_tokens')
    .insert({ email, token_hash: tokenHash, expires_at: expiresAt })
    .select('id')
    .single();
  if (tokenError || !insertedToken) {
    console.error(
      'request-candidate-access token insert failed',
      tokenError?.message ?? 'insert returned no row',
    );
    return genericSuccess();
  }

  const accessUrl = `${publicAppUrl}/candidato/acesso?token=${encodeURIComponent(token)}`;
  try {
    await sendEmail({
      to: email,
      subject: 'Seu acesso às candidaturas',
      html: renderEmail({
        title: 'Seu acesso às candidaturas',
        companyName: 'Noren',
        heading: 'Acesse suas candidaturas',
        paragraphs: [
          'Recebemos um pedido para acessar sua área de candidato.',
          'O link fica disponível por 30 minutos. Se você não fez esse pedido, pode ignorar este e-mail.',
        ],
        button: { label: 'Ver minhas candidaturas', url: accessUrl },
        fallbackUrl: accessUrl,
      }),
    });
  } catch (error) {
    await admin.from('applicant_tokens').delete().eq('id', insertedToken.id);
    console.error(
      'request-candidate-access email send failed',
      error instanceof Error ? error.message : 'unknown error',
    );
    return genericSuccess();
  }

  return genericSuccess();
});
