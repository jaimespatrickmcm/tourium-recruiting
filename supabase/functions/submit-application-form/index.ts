// Edge Function: submit-application-form
// Persiste a candidatura completa (formulário Typeform-style) chamada depois do
// apply simplificado. Atualiza a application com city + phone + form_completed_at
// e grava as respostas em application_answers. Service role: única via de escrita
// em application_answers.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type AnswerSource = 'candidate_info' | 'job_question' | 'culture' | 'reasoning';

type AnswerInput = {
  source: AnswerSource;
  refId?: string | null;
  question: string;
  answer?: string | null;
  canaryToken?: string | null;
};

type Payload = {
  applicationId?: string;
  companySlug: string;
  jobSlug: string;
  candidateInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
  };
  answers?: AnswerInput[];
};

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 40;
const MAX_CITY = 120;
const MAX_ANSWER = 5000;
const MAX_ANSWERS = 100;
const MAX_QUESTION = 2000;

const ALLOWED_SOURCES: AnswerSource[] = ['candidate_info', 'job_question', 'culture', 'reasoning'];

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

  const info = payload.candidateInfo ?? {};
  const name = (info.name ?? '').trim();
  const email = (info.email ?? '').trim().toLowerCase();
  const phone = (info.phone ?? '').trim();
  const city = (info.city ?? '').trim();

  if (
    name.length > MAX_NAME ||
    email.length > MAX_EMAIL ||
    phone.length > MAX_PHONE ||
    city.length > MAX_CITY
  ) {
    return jsonResponse({ error: 'Algum campo passou do tamanho permitido' }, 400);
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResponse({ error: 'E-mail inválido' }, 400);
  }

  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  if (answers.length > MAX_ANSWERS) {
    return jsonResponse({ error: 'Muitas respostas' }, 400);
  }
  for (const a of answers) {
    if (!a || typeof a !== 'object') {
      return jsonResponse({ error: 'Resposta inválida' }, 400);
    }
    if (!ALLOWED_SOURCES.includes(a.source)) {
      return jsonResponse({ error: 'Origem de resposta inválida' }, 400);
    }
    if ((a.question ?? '').length > MAX_QUESTION) {
      return jsonResponse({ error: 'Pergunta longa demais' }, 400);
    }
    if ((a.answer ?? '').length > MAX_ANSWER) {
      return jsonResponse({ error: 'Resposta longa demais' }, 400);
    }
  }

  // Detecção anti-IA: a resposta contém a palavra-canário injetada no enunciado?
  const canaryHits = answers
    .filter((a) => {
      const tok = (a.canaryToken ?? '').trim().toLowerCase();
      const ans = (a.answer ?? '').toLowerCase();
      return tok.length > 0 && ans.includes(tok);
    })
    .map((a) => ({ ref_id: a.refId ?? null, source: a.source, token: a.canaryToken }));
  const aiSuspected = canaryHits.length > 0;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve empresa + vaga pelos slugs.
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('id')
    .eq('slug', payload.companySlug)
    .maybeSingle();
  if (companyError || !company) {
    return jsonResponse({ error: 'Empresa não encontrada' }, 404);
  }

  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, status')
    .eq('company_id', company.id)
    .eq('slug', payload.jobSlug)
    .maybeSingle();
  if (jobError || !job) {
    return jsonResponse({ error: 'Vaga não encontrada' }, 404);
  }

  // Resolve application: usa a existente se o id bater com a vaga, senão cria.
  let applicationId: string | null = null;

  if (payload.applicationId) {
    const { data: existing } = await admin
      .from('applications')
      .select('id, job_id')
      .eq('id', payload.applicationId)
      .maybeSingle();
    if (existing && existing.job_id === job.id) {
      applicationId = existing.id;
    }
  }

  if (!applicationId) {
    if (!name || !email) {
      return jsonResponse({ error: 'Nome e e-mail são obrigatórios' }, 400);
    }
    const { data: created, error: createError } = await admin
      .from('applications')
      .insert({
        job_id: job.id,
        company_id: company.id,
        candidate_name: name,
        candidate_email: email,
        candidate_phone: phone || null,
        city: city || null,
        form_completed_at: new Date().toISOString(),
        ai_suspected: aiSuspected,
        ai_flags: aiSuspected ? { canary_hits: canaryHits, detected_at: new Date().toISOString() } : null,
      })
      .select('id')
      .single();
    if (createError || !created) {
      if (createError?.code === '23505') {
        return jsonResponse({ error: 'Você já se candidatou a essa vaga com esse e-mail.' }, 409);
      }
      return jsonResponse({ error: createError?.message ?? 'Falha ao salvar aplicação' }, 500);
    }
    applicationId = created.id;
  } else {
    // Atualiza a application existente com os campos do formulário completo.
    const update: Record<string, unknown> = {
      city: city || null,
      form_completed_at: new Date().toISOString(),
    };
    if (phone) update.candidate_phone = phone;
    // Só liga o flag; nunca desliga um já marcado.
    if (aiSuspected) {
      update.ai_suspected = true;
      update.ai_flags = { canary_hits: canaryHits, detected_at: new Date().toISOString() };
    }
    const { error: updateError } = await admin
      .from('applications')
      .update(update)
      .eq('id', applicationId);
    if (updateError) {
      return jsonResponse({ error: updateError.message ?? 'Falha ao atualizar aplicação' }, 500);
    }
  }

  // Grava respostas não vazias.
  const rows = answers
    .filter((a) => (a.answer ?? '').trim().length > 0)
    .map((a) => ({
      application_id: applicationId,
      company_id: company.id,
      source: a.source,
      ref_id: a.refId ?? null,
      question_snapshot: (a.question ?? '').slice(0, MAX_QUESTION),
      answer: (a.answer ?? '').trim(),
    }));

  if (rows.length > 0) {
    const { error: answersError } = await admin.from('application_answers').insert(rows);
    if (answersError) {
      return jsonResponse({ error: answersError.message ?? 'Falha ao salvar respostas' }, 500);
    }
  }

  return jsonResponse({ ok: true, applicationId });
});
