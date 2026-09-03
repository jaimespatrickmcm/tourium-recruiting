// Edge Function: revoke-collaborator-access
// Revoga o acesso corporativo de uma pessoa. Somente owner da mesma empresa.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { collaboratorId?: string; endEmployment?: boolean };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const value = forwarded?.split(',')[0].trim() || req.headers.get('cf-connecting-ip');
  return value || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado' }, 401);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }
  const collaboratorId = (body.collaboratorId ?? '').trim();
  if (!collaboratorId) {
    return jsonResponse({ ok: false, error: 'collaboratorId obrigatório' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ ok: false, error: 'JWT inválido' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: owner, error: ownerError } = await admin
    .from('users')
    .select('company_id, role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (ownerError) return jsonResponse({ ok: false, error: 'Não conseguimos validar o acesso' }, 500);
  if (!owner?.company_id || owner.role !== 'owner') {
    return jsonResponse({ ok: false, error: 'Apenas o Admin pode revogar este acesso' }, 403);
  }

  const { data: collaborator, error: collaboratorError } = await admin
    .from('collaborators')
    .select('id, company_id, access_status')
    .eq('id', collaboratorId)
    .maybeSingle();
  if (collaboratorError) {
    return jsonResponse({ ok: false, error: 'Não conseguimos localizar a pessoa' }, 500);
  }
  if (!collaborator) return jsonResponse({ ok: false, error: 'Pessoa não encontrada' }, 404);
  if (collaborator.company_id !== owner.company_id) {
    return jsonResponse({ ok: false, error: 'Sem acesso a esta pessoa' }, 403);
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    auth_user_id: null,
    pending_corporate_email: null,
    access_status: 'revoked',
  };
  if (body.endEmployment) {
    updates.status = 'desligado';
    updates.employment_ended_at = now;
  }

  const { error: revokeError } = await admin
    .from('collaborators')
    .update(updates)
    .eq('id', collaboratorId)
    .eq('company_id', owner.company_id);
  if (revokeError) {
    return jsonResponse({ ok: false, error: 'Não conseguimos revogar o acesso' }, 500);
  }

  await admin.from('audit_log').insert({
    company_id: owner.company_id,
    actor_id: userData.user.id,
    action: 'collaborator.access.revoke',
    entity_type: 'collaborator',
    entity_id: collaboratorId,
    payload: { previous_status: collaborator.access_status, employment_ended: Boolean(body.endEmployment) },
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent'),
  });

  return jsonResponse({ ok: true });
});
