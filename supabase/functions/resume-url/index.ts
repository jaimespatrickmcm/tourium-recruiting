// Edge Function: resume-url
// Recrutador autenticado pede um link temporário (5min) pra ver o currículo de
// uma candidatura da própria empresa. Bucket 'resumes' é privado.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { applicationId: string };

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
  const companyId = userRow?.company_id;
  if (!companyId) return jsonResponse({ error: 'Usuário sem empresa vinculada' }, 403);

  const { data: app } = await admin
    .from('applications')
    .select('company_id, resume_path')
    .eq('id', payload.applicationId)
    .maybeSingle();
  if (!app) return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  if (app.company_id !== companyId) return jsonResponse({ error: 'Sem acesso' }, 403);
  if (!app.resume_path) return jsonResponse({ error: 'Sem currículo anexado' }, 404);

  const { data, error } = await admin.storage.from('resumes').createSignedUrl(app.resume_path, 300);
  if (error || !data) {
    return jsonResponse({ error: error?.message ?? 'Falha ao gerar link' }, 500);
  }

  return jsonResponse({ ok: true, url: data.signedUrl });
});
