// Edge Function: delete-collaborator
// Valida a sessão e delega a exclusão transacional à RPC owner-only. A Edge
// não usa service role e não executa deletes parciais.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = { collaboratorId?: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }

  const collaboratorId = (payload.collaboratorId ?? '').trim();
  if (!UUID_PATTERN.test(collaboratorId)) {
    return jsonResponse({ ok: false, error: 'collaboratorId inválido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
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

  const { data: deleted, error: deleteError } = await userClient.rpc(
    'delete_collaborator_cascade',
    { target_collaborator_id: collaboratorId },
  );

  if (deleteError) {
    if (deleteError.code === '42501') {
      return jsonResponse({ ok: false, error: 'Apenas o Admin pode excluir esta pessoa' }, 403);
    }
    if (deleteError.code === 'P0002') {
      return jsonResponse({ ok: false, error: 'Pessoa não encontrada' }, 404);
    }

    console.error('[delete-collaborator] transactional delete failed:', deleteError.code);
    return jsonResponse({ ok: false, error: 'Não conseguimos excluir esta pessoa' }, 500);
  }

  if (deleted !== true) {
    console.error('[delete-collaborator] RPC returned an unexpected result');
    return jsonResponse({ ok: false, error: 'Não conseguimos excluir esta pessoa' }, 500);
  }

  return jsonResponse({ ok: true });
});
