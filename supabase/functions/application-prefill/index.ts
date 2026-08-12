// Edge Function: application-prefill
// Endpoint público. Recebe applicationId + token de acesso do candidato e, se o
// token bater com o e-mail da candidatura, devolve os dados já conhecidos (nome,
// e-mail, telefone, cidade) pra pré-preencher o formulário. Tudo com service role.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { applicationId?: string; token?: string };

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const applicationId = (payload.applicationId ?? '').trim();
  const token = (payload.token ?? '').trim();
  if (!applicationId || !token) {
    return jsonResponse({ error: 'Acesso inválido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: application, error: appError } = await admin
    .from('applications')
    .select('candidate_name, candidate_email, candidate_phone, city')
    .eq('id', applicationId)
    .maybeSingle();

  if (appError) {
    return jsonResponse({ error: 'Não conseguimos carregar seus dados agora.' }, 500);
  }
  if (!application) {
    return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  }

  const email = (application.candidate_email ?? '').trim().toLowerCase();
  const tokenHash = await sha256Hex(token);

  // O token é por e-mail. Só liberamos se o hash bater com um token do e-mail
  // dono desta candidatura.
  const { data: tokenRow, error: tokenError } = await admin
    .from('applicant_tokens')
    .select('id')
    .eq('token_hash', tokenHash)
    .eq('email', email)
    .maybeSingle();

  if (tokenError) {
    return jsonResponse({ error: 'Não conseguimos validar seu acesso agora.' }, 500);
  }
  if (!tokenRow) {
    return jsonResponse({ error: 'Acesso inválido' }, 401);
  }

  // Marca o uso do token. Falha aqui não bloqueia o acesso.
  await admin
    .from('applicant_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  return jsonResponse({
    ok: true,
    name: application.candidate_name ?? null,
    email: application.candidate_email ?? null,
    phone: application.candidate_phone ?? null,
    city: application.city ?? null,
  });
});
