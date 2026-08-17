// Edge Function: transcribe-audio
// O candidato grava a resposta falando, a gente transcreve e devolve o texto pro
// campo. Ele revisa e envia como texto normal.
//
// O ÁUDIO NÃO É GUARDADO. Chega aqui, vira texto, some com o fim do request.
// Voz identifica pessoa, então guardar aumentaria a superfície de LGPD sem
// necessidade: o que a análise lê é a transcrição.
//
// Endpoint pago e chamado de formulário público, então o gate é o mesmo do
// submit-application-form: só passa quem tem a candidatura E o token do link
// individual do e-mail. Sem isso qualquer um transcreveria áudio na conta da
// empresa.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { transcribeAudio } from '../_shared/openai.ts';

// 10 MB cobre com folga uma resposta falada de vários minutos em opus/aac.
// Acima disso é quase certo que não é resposta de formulário.
const MAX_BYTES = 10 * 1024 * 1024;

// Extensões que a API de transcrição aceita. MediaRecorder entrega webm no
// Chrome e no Firefox, e mp4 no Safari, então os dois principais estão cobertos.
const EXT_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/mpga': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
};

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: 'Envio inválido' }, 400);
  }

  const applicationId = String(form.get('applicationId') ?? '').trim();
  const token = String(form.get('token') ?? '').trim();
  const file = form.get('audio');

  if (!applicationId || !token) {
    return jsonResponse({ error: 'Acesso inválido' }, 401);
  }
  if (!(file instanceof File) && !(file instanceof Blob)) {
    return jsonResponse({ error: 'Áudio faltando' }, 400);
  }
  const audio = file as Blob;
  if (audio.size === 0) return jsonResponse({ error: 'Gravação vazia' }, 400);
  if (audio.size > MAX_BYTES) {
    return jsonResponse({ error: 'Gravação muito longa. Tente responder em partes.' }, 413);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mesmo gate do submit: a candidatura tem que existir e o token tem que ser
  // o do e-mail DAQUELE candidato. Token de outra pessoa não serve.
  const { data: app } = await admin
    .from('applications')
    .select('id, candidate_email')
    .eq('id', applicationId)
    .maybeSingle();
  if (!app) return jsonResponse({ error: 'Acesso inválido' }, 401);

  const tokenHash = await sha256Hex(token);
  const { data: tokenRow } = await admin
    .from('applicant_tokens')
    .select('id')
    .eq('token_hash', tokenHash)
    .eq('email', (app.candidate_email ?? '').trim().toLowerCase())
    .maybeSingle();
  if (!tokenRow) return jsonResponse({ error: 'Acesso inválido' }, 401);

  const type = (audio.type || 'audio/webm').split(';')[0].trim();
  const ext = EXT_BY_TYPE[type] ?? 'webm';

  try {
    const { text } = await transcribeAudio({
      apiKey,
      audio,
      filename: `resposta.${ext}`,
      language: 'pt',
    });
    if (!text) {
      return jsonResponse(
        { error: 'Não deu pra entender o áudio. Tente gravar de novo, mais perto do microfone.' },
        422,
      );
    }
    return jsonResponse({ ok: true, text });
  } catch (err) {
    console.error('[transcribe-audio]', err instanceof Error ? err.message : err);
    return jsonResponse({ error: 'Não deu pra transcrever agora. Tente de novo.' }, 502);
  }
});
