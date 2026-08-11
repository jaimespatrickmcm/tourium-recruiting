// Edge Function: create-resume-upload
// Público. O candidato pede um destino pra subir o currículo antes de submeter.
// Valida que a vaga existe e está ativa, gera um path no bucket privado 'resumes'
// e devolve um signed upload URL (token) pro cliente subir o PDF direto.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { companySlug: string; jobSlug: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  if (!payload.companySlug || !payload.jobSlug) {
    return jsonResponse({ error: 'Campos obrigatórios faltando' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', payload.companySlug)
    .maybeSingle();
  if (!company) return jsonResponse({ error: 'Empresa não encontrada' }, 404);

  const { data: job } = await admin
    .from('jobs')
    .select('id, status')
    .eq('company_id', company.id)
    .eq('slug', payload.jobSlug)
    .maybeSingle();
  if (!job) return jsonResponse({ error: 'Vaga não encontrada' }, 404);
  if (job.status !== 'active') return jsonResponse({ error: 'Vaga não está ativa' }, 410);

  const path = `${company.id}/pending/${crypto.randomUUID()}.pdf`;
  const { data, error } = await admin.storage.from('resumes').createSignedUploadUrl(path);
  if (error || !data) {
    return jsonResponse({ error: error?.message ?? 'Falha ao preparar upload' }, 500);
  }

  return jsonResponse({ ok: true, path: data.path, token: data.token });
});
