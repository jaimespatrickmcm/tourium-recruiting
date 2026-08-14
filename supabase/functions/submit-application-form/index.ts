// Edge Function: submit-application-form
// Persiste a candidatura completa (formulário Typeform-style) chamada depois do
// apply simplificado. Atualiza a application com city + phone + form_completed_at
// e grava as respostas em application_answers. Service role: única via de escrita
// em application_answers.
//
// Histórico imutável: além do question_snapshot, congela guidance + rubrica
// (guidance_snapshot / rubric_snapshot) no momento do submit. Assim, regenerar
// ou editar perguntas depois nunca muda o critério que vale pras respostas já
// enviadas.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type AnswerSource =
  | 'candidate_info'
  | 'job_question'
  | 'profile'
  | 'culture'
  | 'reasoning'
  | 'curiosity';

type AnswerInput = {
  source: AnswerSource;
  refId?: string | null;
  question: string;
  answer?: string | null;
  canaryToken?: string | null;
};

type Payload = {
  applicationId?: string;
  /** Token individual do convite (mesmo do application-prefill). Obrigatório. */
  token?: string;
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
const MAX_SNAPSHOT = 2000;

const ALLOWED_SOURCES: AnswerSource[] = [
  'candidate_info',
  'job_question',
  'profile',
  'culture',
  'reasoning',
  'curiosity',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime = (globalThis as any).EdgeRuntime;

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

  // O form é por convite: só aceita candidatura existente + token individual
  // válido (mesma validação do application-prefill). O form não cria mais
  // candidatura; quem chega aqui já se candidatou e avançou de etapa.
  const inviteToken = (payload.token ?? '').trim();
  if (!payload.applicationId || !inviteToken) {
    return jsonResponse({ error: 'Esse formulário é acessado pelo link individual do seu email.' }, 401);
  }

  const { data: existing } = await admin
    .from('applications')
    .select('id, job_id, candidate_email, status')
    .eq('id', payload.applicationId)
    .maybeSingle();
  if (!existing || existing.job_id !== job.id) {
    return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  }

  const tokenHash = await sha256Hex(inviteToken);
  const candidateEmail = (existing.candidate_email ?? '').trim().toLowerCase();
  const { data: tokenRow, error: tokenError } = await admin
    .from('applicant_tokens')
    .select('id')
    .eq('token_hash', tokenHash)
    .eq('email', candidateEmail)
    .maybeSingle();
  if (tokenError) {
    return jsonResponse({ error: 'Não conseguimos validar seu acesso agora.' }, 500);
  }
  if (!tokenRow) {
    return jsonResponse({ error: 'Esse formulário é acessado pelo link individual do seu email.' }, 401);
  }

  const applicationId: string = existing.id;

  // Preencher o formulário É a etapa de fit cultural. Se a pessoa preencheu
  // ainda em triagem (ex.: chegou pelo token da área do candidato), avança
  // sozinha, senão o recrutador moveria depois e ela receberia convite pro
  // que já preencheu.
  const promote = existing.status === 'triagem';

  // Atualiza a application existente com os campos do formulário completo.
  const update: Record<string, unknown> = {
    city: city || null,
    form_completed_at: new Date().toISOString(),
  };
  if (promote) update.status = 'fit_cultural';
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

  if (promote) {
    // Registra na linha do tempo pra o recrutador ver que quem moveu foi o
    // próprio preenchimento, não alguém do time.
    const { error: eventError } = await admin.from('application_events').insert({
      application_id: applicationId,
      company_id: company.id,
      actor_id: null,
      type: 'stage_change',
      from_status: 'triagem',
      to_status: 'fit_cultural',
      note: null,
    });
    if (eventError) {
      console.error('[submit-application-form] evento de etapa:', eventError.message);
    }
  }

  // Congela o critério interno (guidance + rubrica) de cada pergunta junto com
  // a resposta. O lookup é feito agora, com o texto vigente no momento do
  // submit; depois disso o histórico não depende mais das tabelas de perguntas.
  // Escopado por company/job: refId vem do payload anônimo e não pode servir
  // pra congelar critério interno de outro tenant na candidatura.
  const refIds = answers.map((a) => a.refId).filter((id): id is string => Boolean(id));
  const criteriaById = new Map<string, { guidance: string | null; scoring_rubric: string | null }>();
  let criteriaLookupOk = false;
  if (refIds.length > 0) {
    const [companyQ, jobQ] = await Promise.all([
      admin
        .from('company_questions')
        .select('id, guidance, scoring_rubric')
        .eq('company_id', company.id)
        .in('id', refIds),
      admin
        .from('job_questions')
        .select('id, guidance, scoring_rubric')
        .eq('company_id', company.id)
        .eq('job_id', job.id)
        .in('id', refIds),
    ]);
    if (companyQ.error) {
      console.error('[submit-application-form] criteria lookup (company):', companyQ.error.message);
    }
    if (jobQ.error) {
      console.error('[submit-application-form] criteria lookup (job):', jobQ.error.message);
    }
    criteriaLookupOk = !companyQ.error && !jobQ.error;
    for (const q of [...(companyQ.data ?? []), ...(jobQ.data ?? [])]) {
      criteriaById.set(q.id, { guidance: q.guidance, scoring_rubric: q.scoring_rubric });
    }
  }

  // Grava respostas não vazias. Com o lookup ok, snapshot vazio ('') é o estado
  // congelado "pergunta sem critério": a análise não pode aplicar retroativamente
  // um critério criado depois. Snapshot null (lookup falhou ou resposta antiga)
  // mantém o fallback de lookup ao vivo.
  const rows = answers
    .filter((a) => (a.answer ?? '').trim().length > 0)
    .map((a) => {
      const criteria = a.refId ? criteriaById.get(a.refId) : undefined;
      const freeze = criteriaLookupOk && Boolean(a.refId);
      return {
        application_id: applicationId,
        company_id: company.id,
        source: a.source,
        ref_id: a.refId ?? null,
        question_snapshot: (a.question ?? '').slice(0, MAX_QUESTION),
        answer: (a.answer ?? '').trim(),
        guidance_snapshot: freeze ? (criteria?.guidance ?? '').slice(0, MAX_SNAPSHOT) : null,
        rubric_snapshot: freeze ? (criteria?.scoring_rubric ?? '').slice(0, MAX_SNAPSHOT) : null,
      };
    });

  if (rows.length > 0) {
    // Reenvio substitui: a pessoa pode voltar e preencher de novo, e sem limpar
    // as respostas antigas sairiam duplicadas e a análise leria a mesma pergunta
    // duas vezes. O envio mais recente é o que vale.
    //
    // Antes isso era condicionado a `createdNow`, que existia quando esta função
    // ainda podia CRIAR a candidatura. Com o form por convite ela sempre já
    // existe (vem do link individual), o caminho de criação saiu e a variável
    // ficou órfã: `ReferenceError: createdNow is not defined`, 500 em todo
    // envio. Como a candidatura nunca é nova aqui, a limpeza é sempre.
    const { error: clearError } = await admin
      .from('application_answers')
      .delete()
      .eq('application_id', applicationId);
    if (clearError) {
      console.error('[submit-application-form] limpar respostas antigas:', clearError.message);
    }
    const { error: answersError } = await admin.from('application_answers').insert(rows);
    if (answersError) {
      return jsonResponse({ error: answersError.message ?? 'Falha ao salvar respostas' }, 500);
    }
  }

  // Re-análise com o formulário completo: marca pending (a UI mostra reanalisando)
  // e dispara analyze-candidate, que agora usa CV + respostas + rubricas pro Scout.
  await admin.from('ai_analyses').upsert(
    { application_id: applicationId, status: 'pending' },
    { onConflict: 'application_id' },
  );
  const trigger = fetch(`${supabaseUrl}/functions/v1/analyze-candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ applicationId }),
  }).catch((err) => console.error('[submit-application-form] failed to trigger re-analyze:', err));
  if (runtime?.waitUntil) {
    runtime.waitUntil(trigger);
  } else {
    await trigger;
  }

  return jsonResponse({ ok: true, applicationId });
});
