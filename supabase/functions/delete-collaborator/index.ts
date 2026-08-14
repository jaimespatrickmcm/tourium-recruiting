// Edge Function: delete-collaborator
// Recrutador autenticado remove de vez alguém do time da própria empresa.
// Operação destrutiva e tenant-scoped: valida que o company_id do usuário bate
// com o do colaborador ANTES de qualquer delete. Cross-tenant é rejeitado com 403.
//
// Remove, nesta ordem: collaborator_scores, development_goals e a linha de
// collaborators. Os dois primeiros já têm ON DELETE CASCADE, mas apagamos
// explicitamente pra ordem ficar óbvia e não depender só do cascade.
// Grava uma linha em audit_log (LGPD).
//
// Não mexe na candidatura de origem: se a pessoa veio do pipeline, a application
// continua lá e pode virar colaborador de novo.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { collaboratorId: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? 'unknown';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }
  const collaboratorId = (payload.collaboratorId ?? '').trim();
  if (!collaboratorId) return jsonResponse({ ok: false, error: 'collaboratorId obrigatório' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500);
  }

  // Valida o JWT do chamador e resolve a empresa dele (mesma fonte do custom
  // claim company_id: a tabela users, populada pelo auth hook).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ ok: false, error: 'JWT inválido' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();
  const companyId = userRow?.company_id;
  if (!companyId) return jsonResponse({ ok: false, error: 'Usuário sem empresa vinculada' }, 403);

  // Ownership check: o colaborador precisa ser da mesma empresa do usuário.
  const { data: collab, error: collabError } = await admin
    .from('collaborators')
    .select('id, company_id, full_name, email, application_id, candidate_id')
    .eq('id', collaboratorId)
    .maybeSingle();
  if (collabError) return jsonResponse({ ok: false, error: collabError.message }, 500);
  if (!collab) return jsonResponse({ ok: false, error: 'Colaborador não encontrado' }, 404);
  if (collab.company_id !== companyId) {
    return jsonResponse({ ok: false, error: 'Sem acesso a esse colaborador' }, 403);
  }

  // A partir daqui é destrutivo.
  const { error: scoresError } = await admin
    .from('collaborator_scores')
    .delete()
    .eq('collaborator_id', collaboratorId);
  if (scoresError) {
    return jsonResponse(
      { ok: false, error: `Falha ao apagar avaliações: ${scoresError.message}` },
      500,
    );
  }

  const { error: goalsError } = await admin
    .from('development_goals')
    .delete()
    .eq('collaborator_id', collaboratorId);
  if (goalsError) {
    return jsonResponse({ ok: false, error: `Falha ao apagar metas: ${goalsError.message}` }, 500);
  }

  const { error: deleteError } = await admin
    .from('collaborators')
    .delete()
    .eq('id', collaboratorId)
    .eq('company_id', companyId);
  if (deleteError) {
    return jsonResponse(
      { ok: false, error: `Falha ao remover do time: ${deleteError.message}` },
      500,
    );
  }

  // Audit log (LGPD): toda mutação em dado de candidato gera linha.
  await admin.from('audit_log').insert({
    company_id: companyId,
    actor_id: userData.user.id,
    action: 'collaborator.delete',
    entity_type: 'collaborator',
    entity_id: collaboratorId,
    payload: {
      full_name: collab.full_name,
      email: collab.email,
      application_id: collab.application_id,
      candidate_id: collab.candidate_id,
      reason: 'manual',
    },
    ip_address: clientIp(req) === 'unknown' ? null : clientIp(req),
    user_agent: req.headers.get('user-agent'),
  });

  return jsonResponse({ ok: true });
});
