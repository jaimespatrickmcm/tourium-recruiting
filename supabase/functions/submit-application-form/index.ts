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
  let createdNow = false;

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

  // O formulário COMPLETA uma candidatura, não cria uma segunda. Se o link
  // individual não trouxe o id (a pessoa chegou pela career page, ou o ?app= se
  // perdeu no caminho), acha a candidatura dela nesta vaga pelo e-mail. Sem
  // isso, o insert bate no unique (job_id, lower(email)) e ela perde as
  // respostas que acabou de escrever.
  // Comparação em JS pra bater exatamente com o índice: ilike trataria o "_" de
  // um e-mail como curinga e poderia casar com a pessoa errada.
  if (!applicationId && email) {
    const { data: sameJob } = await admin
      .from('applications')
      .select('id, candidate_email')
      .eq('job_id', job.id);
    const match = (sameJob ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => String(a.candidate_email ?? '').trim().toLowerCase() === email,
    );
    if (match) applicationId = match.id;
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
    if (createError?.code === '23505') {
      // Corrida: a candidatura nasceu entre a busca acima e este insert. Em vez
      // de devolver erro e descartar as respostas, aproveita a que existe.
      const { data: raced } = await admin
        .from('applications')
        .select('id, candidate_email')
        .eq('job_id', job.id);
      const match = (raced ?? []).find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => String(a.candidate_email ?? '').trim().toLowerCase() === email,
      );
      if (!match) {
        return jsonResponse({ error: 'Não deu pra salvar suas respostas. Tente de novo.' }, 500);
      }
      applicationId = match.id;
    } else if (createError || !created) {
      return jsonResponse({ error: createError?.message ?? 'Falha ao salvar aplicação' }, 500);
    } else {
      applicationId = created.id;
      createdNow = true;
    }
  }

  // Candidatura que já existia (veio do link, do e-mail ou da corrida): completa
  // com os dados do formulário. A recém-criada já nasceu com tudo isso.
  if (!createdNow) {
    // Preencher o formulário É a etapa de fit cultural. Quem ainda está em
    // triagem avança sozinho, senão o recrutador avançaria depois e a pessoa
    // receberia de novo o convite pra preencher o que já preencheu.
    const { data: current } = await admin
      .from('applications')
      .select('status')
      .eq('id', applicationId)
      .maybeSingle();
    const promote = current?.status === 'triagem';

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
    // Reenvio substitui: agora que a pessoa pode voltar e preencher de novo, as
    // respostas antigas sairiam duplicadas e a análise leria a mesma pergunta
    // duas vezes. O envio mais recente é o que vale.
    if (!createdNow) {
      const { error: clearError } = await admin
        .from('application_answers')
        .delete()
        .eq('application_id', applicationId);
      if (clearError) {
        console.error('[submit-application-form] limpar respostas antigas:', clearError.message);
      }
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
