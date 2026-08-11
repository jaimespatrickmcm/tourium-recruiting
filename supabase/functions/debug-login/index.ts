// Edge Function: debug-login
// DEV ONLY: gera OTP via Admin API e retorna o plaintext direto na response.
// Bypassa email pipeline pra testar login sem depender de Resend/template.
// Whitelist de emails autorizados — bloqueia em prod implicitamente por não permitir
// qualquer email arbitrário.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ALLOWED_EMAILS = new Set([
  'jaimespatrick@gmail.com',
  'jaimes@mcmbr.com',
]);

type Payload = { email: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  // Trava dura: só funciona se o secret DEBUG_LOGIN_ENABLED=true estiver setado
  // no ambiente (nunca setar em produção). Sem isso, responde como se não existisse.
  if (Deno.env.get('DEBUG_LOGIN_ENABLED') !== 'true') {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const email = (payload.email ?? '').trim().toLowerCase();
  if (!email || !ALLOWED_EMAILS.has(email)) {
    return jsonResponse({ error: 'Email não autorizado pra debug' }, 403);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // generateLink com type='magiclink' gera OTP, armazena hash no DB, NÃO envia email.
  // Returns properties.email_otp = plaintext 6-digit code.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) {
    return jsonResponse({ error: `generateLink: ${error.message}` }, 500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = (data as any)?.properties ?? {};
  const otp = props.email_otp as string | undefined;

  if (!otp) {
    return jsonResponse({ error: 'OTP não retornado pela admin API', raw: props }, 500);
  }

  return jsonResponse({
    ok: true,
    email,
    otp,
    note: 'Use este código no /verify-otp. Hash já armazenado no DB.',
  });
});
