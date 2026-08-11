// Edge Function: delete-application
// Recrutador autenticado apaga por completo uma candidatura da própria empresa,
// pra permitir reprocessar/estressar o fluxo do zero. Operação destrutiva e
// tenant-scoped: valida que o company_id do usuário bate com o da application
// ANTES de qualquer delete. Cross-tenant delete é rejeitado com 403.
//
// Remove, nesta ordem: application_answers, ai_analyses, failed_analyses (se
// existir), o arquivo do currículo no bucket privado 'resumes' e, por fim, a
// linha de applications. Grava uma linha em audit_log (LGPD).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { applicationId: string };

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
  const applicationId = (payload.applicationId ?? '').trim();
  if (!applicationId) return jsonResponse({ ok: false, error: 'applicationId obrigatório' }, 400);

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

  // Ownership check: a application precisa ser da mesma empresa do usuário.
  const { data: app, error: appError } = await admin
    .from('applications')
    .select('id, company_id, job_id, candidate_email, resume_path')
    .eq('id', applicationId)
    .maybeSingle();
  if (appError) return jsonResponse({ ok: false, error: appError.message }, 500);
  if (!app) return jsonResponse({ ok: false, error: 'Candidatura não encontrada' }, 404);
  if (app.company_id !== companyId) {
    return jsonResponse({ ok: false, error: 'Sem acesso a essa candidatura' }, 403);
  }

  // A partir daqui é destrutivo. Deleta os filhos explicitamente (mesmo que
  // ai_analyses e application_answers já tenham ON DELETE CASCADE) pra deixar a
  // ordem óbvia e não depender só do cascade.
  const { error: answersError } = await admin
    .from('application_answers')
    .delete()
    .eq('application_id', applicationId);
  if (answersError) {
    return jsonResponse({ ok: false, error: `Falha ao apagar respostas: ${answersError.message}` }, 500);
  }

  const { error: analysesError } = await admin
    .from('ai_analyses')
    .delete()
    .eq('application_id', applicationId);
  if (analysesError) {
    return jsonResponse({ ok: false, error: `Falha ao apagar análises: ${analysesError.message}` }, 500);
  }

  // failed_analyses pode não existir no schema atual. Tenta apagar e ignora o
  // erro de "tabela não existe" pra manter a função à prova de futuro.
  const { error: failedError } = await admin
    .from('failed_analyses')
    .delete()
    .eq('application_id', applicationId);
  if (failedError && !/does not exist|not find the table|schema cache/i.test(failedError.message)) {
    return jsonResponse({ ok: false, error: `Falha ao apagar fila de retry: ${failedError.message}` }, 500);
  }

  // Remove o currículo do bucket privado, se houver.
  if (app.resume_path) {
    const { error: storageError } = await admin.storage.from('resumes').remove([app.resume_path]);
    if (storageError) {
      // Não trava a exclusão da candidatura por causa do arquivo: loga e segue.
      console.error('[delete-application] failed to remove resume:', storageError.message);
    }
  }

  // Por fim, a linha da applications. Cascata em application_events; collaborators
  // fica com application_id = null (ON DELETE SET NULL no schema).
  const { error: deleteError } = await admin
    .from('applications')
    .delete()
    .eq('id', applicationId)
    .eq('company_id', companyId);
  if (deleteError) {
    return jsonResponse({ ok: false, error: `Falha ao apagar candidatura: ${deleteError.message}` }, 500);
  }

  // Audit log (LGPD): toda mutação em dado de candidato gera linha.
  await admin.from('audit_log').insert({
    company_id: companyId,
    actor_id: userData.user.id,
    action: 'application.delete',
    entity_type: 'application',
    entity_id: applicationId,
    payload: {
      job_id: app.job_id,
      candidate_email: app.candidate_email,
      had_resume: Boolean(app.resume_path),
      reason: 'reprocess',
    },
    ip_address: clientIp(req) === 'unknown' ? null : clientIp(req),
    user_agent: req.headers.get('user-agent'),
  });

  return jsonResponse({ ok: true });
});
