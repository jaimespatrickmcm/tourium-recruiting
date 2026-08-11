// Edge Function: request-candidate-access
// Endpoint público. O candidato informa o e-mail e, se existir candidatura com
// esse e-mail, geramos um token de acesso (estilo magic link) e devolvemos o
// token + o caminho de acesso. Sem provedor de e-mail ainda, então retornamos o
// token direto pra UI usar na sessão. Tudo com service role.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

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
    return jsonResponse({ error: 'Não conseguimos verificar agora. Tente de novo.' }, 500);
  }

  if (!apps || apps.length === 0) {
    // Sinal leve: não achamos candidaturas. Não revelamos nada além disso.
    return jsonResponse({ ok: true, found: false });
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
    return jsonResponse({ error: 'Não conseguimos preparar seu acesso agora.' }, 500);
  }

  // Gera token, guarda só o hash.
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const { error: tokenError } = await admin
    .from('applicant_tokens')
    .insert({ email, token_hash: tokenHash });
  if (tokenError) {
    return jsonResponse({ error: 'Não conseguimos gerar seu acesso agora.' }, 500);
  }

  return jsonResponse({
    ok: true,
    found: true,
    token,
    accessPath: `/candidato/acesso?token=${token}`,
  });
});
