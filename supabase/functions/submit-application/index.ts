// Edge Function: submit-application
// Public endpoint que candidato chama ao submeter aplicação no career page.
// Anti-abuso: honeypot + rate limit por IP + caps de tamanho. Cria a application,
// pré-cria a análise como 'pending' e dispara analyze-candidate via waitUntil.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = {
  companySlug: string;
  jobSlug: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  whyInterested?: string;
  candidateId?: string;
  resumePath?: string;
  linkedinUrl?: string;
  highlightAnswer?: string;
  // Honeypot: campo invisível no form. Humano não preenche; bot preenche.
  website?: string;
};

// Rate limit anti-abuso por IP. Desligado por padrão (0). Pra religar quando o
// link público for divulgado, defina o secret SUBMIT_RATE_LIMIT_MAX (ex.: 3).
const RATE_LIMIT_MAX = Number.parseInt(Deno.env.get('SUBMIT_RATE_LIMIT_MAX') ?? '0', 10) || 0;
const RATE_LIMIT_WINDOW_MIN =
  Number.parseInt(Deno.env.get('SUBMIT_RATE_LIMIT_WINDOW_MIN') ?? '10', 10) || 10;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PHONE = 40;
const MAX_WHY = 2000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime = (globalThis as any).EdgeRuntime;

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
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  // Honeypot preenchido: responde sucesso falso e não grava nada.
  if (payload.website && payload.website.trim().length > 0) {
    return jsonResponse({ ok: true, applicationId: crypto.randomUUID() });
  }

  const candidateName = (payload.candidateName ?? '').trim();
  const candidateEmail = (payload.candidateEmail ?? '').trim().toLowerCase();
  const whyInterested = (payload.whyInterested ?? '').trim();
  const candidatePhone = (payload.candidatePhone ?? '').trim();

  if (!candidateName || !candidateEmail || !payload.companySlug || !payload.jobSlug) {
    return jsonResponse({ error: 'Campos obrigatórios faltando' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidateEmail)) {
    return jsonResponse({ error: 'E-mail inválido' }, 400);
  }
  if (
    candidateName.length > MAX_NAME ||
    candidateEmail.length > MAX_EMAIL ||
    candidatePhone.length > MAX_PHONE ||
    whyInterested.length > MAX_WHY
  ) {
    return jsonResponse({ error: 'Algum campo passou do tamanho permitido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Rate limit por IP (desligado enquanto SUBMIT_RATE_LIMIT_MAX não for setado).
  const ip = clientIp(req);
  if (RATE_LIMIT_MAX > 0 && ip !== 'unknown') {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
    const { count } = await admin
      .from('rate_limit_hits')
      .select('*', { count: 'exact', head: true })
      .eq('key', `submit:${ip}`)
      .gte('created_at', since);
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'Muitas tentativas. Tente de novo em alguns minutos.' }, 429);
    }
    await admin.from('rate_limit_hits').insert({ key: `submit:${ip}` });
  }

  // Resolve job by company slug + job slug
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
    .select('id, status, highlight_type, highlight_expected')
    .eq('company_id', company.id)
    .eq('slug', payload.jobSlug)
    .maybeSingle();
  if (jobError || !job) {
    return jsonResponse({ error: 'Vaga não encontrada' }, 404);
  }
  if (job.status !== 'active') {
    return jsonResponse({ error: 'Vaga não está mais aceitando candidaturas' }, 410);
  }

  // candidateId só é aceito se o próprio candidato estiver autenticado (JWT no
  // header) e o token bater com o id enviado. Sem isso, ignora (aplica anônimo).
  let candidateId: string | null = null;
  if (payload.candidateId) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (token && anonKey && token !== anonKey) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user?.id === payload.candidateId) {
        candidateId = payload.candidateId;
      }
    }
  }

  // Currículo: só aceita um path do bucket que pertença a essa empresa (pasta = company.id).
  const resumePath =
    typeof payload.resumePath === 'string' && payload.resumePath.startsWith(`${company.id}/`)
      ? payload.resumePath
      : null;
  const linkedinUrl =
    typeof payload.linkedinUrl === 'string' && payload.linkedinUrl.trim().length > 0
      ? payload.linkedinUrl.trim().slice(0, 300)
      : null;

  // Pergunta de destaque: guarda a resposta e, se for Sim/Não com resposta ideal,
  // marca se bateu (só pra sinalizar pro recrutador, nunca reprova sozinho).
  const highlightAnswer =
    typeof payload.highlightAnswer === 'string' && payload.highlightAnswer.trim().length > 0
      ? payload.highlightAnswer.trim().slice(0, 500)
      : null;
  let highlightMatched: boolean | null = null;
  if (highlightAnswer && job.highlight_type === 'yes_no' && job.highlight_expected) {
    highlightMatched =
      highlightAnswer.trim().toLowerCase() === String(job.highlight_expected).trim().toLowerCase();
  }

  // Create application
  const { data: app, error: appError } = await admin
    .from('applications')
    .insert({
      job_id: job.id,
      company_id: company.id,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone || null,
      why_interested: whyInterested || null,
      candidate_id: candidateId,
      resume_path: resumePath,
      linkedin_url: linkedinUrl,
      highlight_answer: highlightAnswer,
      highlight_matched: highlightMatched,
    })
    .select('id')
    .single();
  if (appError || !app) {
    // 23505 = unique violation no índice (job_id, lower(candidate_email))
    if (appError?.code === '23505') {
      return jsonResponse({ error: 'Você já se candidatou a essa vaga com esse e-mail.' }, 409);
    }
    return jsonResponse({ error: appError?.message ?? 'Falha ao salvar aplicação' }, 500);
  }

  // Pré-cria a análise como pending: se o disparo abaixo falhar, a UI mostra
  // "pendente" com botão de re-analisar em vez de sumir em silêncio.
  await admin.from('ai_analyses').upsert(
    { application_id: app.id, status: 'pending' },
    { onConflict: 'application_id' },
  );

  // waitUntil garante que o disparo não morre junto com o isolate após o Response.
  const trigger = fetch(`${supabaseUrl}/functions/v1/analyze-candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ applicationId: app.id }),
  }).catch((err) => console.error('[submit-application] failed to trigger analyze:', err));

  if (runtime?.waitUntil) {
    runtime.waitUntil(trigger);
  } else {
    await trigger;
  }

  return jsonResponse({ ok: true, applicationId: app.id });
});
