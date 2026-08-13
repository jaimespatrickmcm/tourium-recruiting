// Edge Function: attach-resume
// Recrutador autenticado anexa (ou troca) o currículo de uma candidatura da
// própria empresa. Existe porque muita gente chega pelo cadastro manual ou pelo
// fast apply sem currículo, e sem ele a análise não tem o que ler na etapa de
// triagem: metade do scout fica em aberto por falta de arquivo, não por falta
// de candidato.
//
// Dois passos, mesmo padrão do create-resume-upload público:
//   action 'prepare' -> valida acesso e devolve signed upload URL (o arquivo
//                       sobe direto do navegador, não passa por aqui)
//   action 'confirm' -> confere que o objeto existe no path esperado e só então
//                       grava resume_path. Se o upload falhar no meio, o banco
//                       não fica apontando pra arquivo que não existe.
//
// O bucket 'resumes' é privado e não tem policy de storage: quem escreve nele é
// service role, sempre atrás de uma checagem de dono como esta.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { applicationId: string; action?: 'prepare' | 'confirm'; path?: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }
  if (!payload.applicationId) return jsonResponse({ error: 'applicationId obrigatório' }, 400);
  const action = payload.action ?? 'prepare';

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'JWT inválido' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();
  const companyId = userRow?.company_id as string | undefined;
  if (!companyId) return jsonResponse({ error: 'Usuário sem empresa vinculada' }, 403);

  const { data: app } = await admin
    .from('applications')
    .select('id, company_id, resume_path')
    .eq('id', payload.applicationId)
    .maybeSingle();
  if (!app) return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  if (app.company_id !== companyId) return jsonResponse({ error: 'Sem acesso' }, 403);

  // Prefixo que este usuário pode escrever. Vale pros dois passos: no confirm
  // ele impede que alguém mande um path de outra empresa e roube o arquivo.
  const prefix = `${companyId}/${app.id}/`;

  if (action === 'prepare') {
    // Só PDF. A extração de texto da análise usa unpdf, que não lê DOCX: aceitar
    // DOCX aqui geraria upload com sucesso e leitura vazia depois, que é pior
    // que recusar na hora.
    const path = `${prefix}${crypto.randomUUID()}.pdf`;
    const { data, error } = await admin.storage.from('resumes').createSignedUploadUrl(path);
    if (error || !data) {
      return jsonResponse({ error: error?.message ?? 'Falha ao preparar upload' }, 500);
    }
    return jsonResponse({ ok: true, path: data.path, token: data.token });
  }

  // action === 'confirm'
  const path = String(payload.path ?? '');
  if (!path.startsWith(prefix)) return jsonResponse({ error: 'Destino inválido' }, 400);

  // Confere que o arquivo chegou mesmo antes de apontar o banco pra ele.
  const { data: listed } = await admin.storage
    .from('resumes')
    .list(`${companyId}/${app.id}`, { search: path.split('/').pop() });
  if (!listed || listed.length === 0) {
    return jsonResponse({ error: 'Arquivo não chegou. Tente de novo.' }, 409);
  }

  const previous = app.resume_path as string | null;
  const { error: updateError } = await admin
    .from('applications')
    .update({ resume_path: path })
    .eq('id', app.id);
  if (updateError) return jsonResponse({ error: 'Falha ao vincular o currículo' }, 500);

  // Troca de currículo: apaga o antigo depois de trocar. Best-effort, um órfão
  // no bucket é bem menos grave que perder a referência do novo.
  if (previous && previous !== path) {
    await admin.storage.from('resumes').remove([previous]);
  }

  await admin.from('audit_log').insert({
    company_id: companyId,
    actor_id: userData.user.id,
    action: previous ? 'resume_replaced' : 'resume_attached',
    entity_type: 'applications',
    entity_id: app.id,
  });

  return jsonResponse({ ok: true, path });
});
