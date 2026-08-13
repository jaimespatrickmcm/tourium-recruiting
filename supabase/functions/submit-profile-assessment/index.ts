// Edge Function: submit-profile-assessment
// Recebe { email, method, answers, consent } do teste de perfil comportamental
// (benefício pós-candidatura). Valida e PONTUA no servidor (o cliente nunca
// manda resultado pronto), grava em profile_assessments com consent_at, audita
// e envia por email um consolidado com todos os métodos já concluídos daquele
// email. Service role: única via de escrita na tabela.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, emailConfigured, renderEmail } from '../_shared/email.ts';
import {
  METHOD_INFO,
  DISC_PROFILE_CONTENT,
  BIGFIVE_DIMENSION_INFO,
  validateDiscAnswers,
  validateLikertAnswers,
  scoreDisc,
  scoreBigFive,
  scoreGrit,
  BIGFIVE_ITEMS,
  GRIT_ITEMS,
  type AssessmentMethod,
  type DiscResult,
  type BigFiveResult,
  type GritResult,
  type BigFiveDimension,
} from '../_shared/profile-assessment.ts';

type Payload = {
  email?: string;
  method?: AssessmentMethod;
  answers?: unknown;
  consent?: boolean;
};

const METHODS: AssessmentMethod[] = ['disc', 'bigfive', 'grit'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Parágrafos do email consolidado, na voz da Noren, sem travessão.
function resultParagraphs(byMethod: Partial<Record<AssessmentMethod, unknown>>): string[] {
  const parts: string[] = [];

  const disc = byMethod.disc as DiscResult | undefined;
  if (disc) {
    const primary = DISC_PROFILE_CONTENT[disc.primary];
    const second = DISC_PROFILE_CONTENT[disc.pair[1]];
    parts.push(
      `DISC: seu perfil predominante é ${primary.name} (${primary.disc}), com ${second.name} logo atrás. ${primary.headline}.`,
    );
    parts.push(`No dia a dia, isso aparece como: ${primary.description.slice(0, 6).join(', ')}.`);
    parts.push(`Pontos fortes do seu perfil: ${primary.forcas.slice(0, 4).join('; ')}.`);
    parts.push(`Sob pressão, vale atenção: ${primary.sobPressao.slice(0, 4).join(', ')}.`);
  }

  const bigfive = byMethod.bigfive as BigFiveResult | undefined;
  if (bigfive) {
    const linhas = (Object.keys(bigfive.means) as BigFiveDimension[])
      .map((dim) => `${BIGFIVE_DIMENSION_INFO[dim].label}: ${bigfive.means[dim].toFixed(2)} de 5`)
      .join(' | ');
    parts.push(`Big Five (sua média em cada traço): ${linhas}.`);
  }

  const grit = byMethod.grit as GritResult | undefined;
  if (grit) {
    parts.push(
      `Garra (Grit): ${grit.garraPct}%. Esse número reflete o quanto você combina paixão e perseverança em objetivos de longo prazo, no seu momento atual.`,
    );
  }

  parts.push(
    'Essa análise fica vinculada ao seu perfil na Noren e acompanha suas candidaturas. Não existe perfil certo ou errado: ela ajuda você e as empresas a encontrarem o encaixe certo.',
  );
  return parts;
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

  const email = (payload.email ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonResponse({ error: 'Email inválido' }, 400);
  }
  const method = payload.method;
  if (!method || !METHODS.includes(method)) {
    return jsonResponse({ error: 'Método inválido' }, 400);
  }
  if (payload.consent !== true) {
    return jsonResponse({ error: 'É preciso concordar com o uso do resultado no seu perfil.' }, 400);
  }

  // Valida e pontua no servidor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any;
  if (method === 'disc') {
    if (!validateDiscAnswers(payload.answers)) {
      return jsonResponse({ error: 'Respostas do DISC inválidas' }, 400);
    }
    result = scoreDisc(payload.answers);
  } else if (method === 'bigfive') {
    if (!validateLikertAnswers(payload.answers, BIGFIVE_ITEMS.length)) {
      return jsonResponse({ error: 'Respostas do Big Five inválidas' }, 400);
    }
    result = scoreBigFive(payload.answers);
  } else {
    if (!validateLikertAnswers(payload.answers, GRIT_ITEMS.length)) {
      return jsonResponse({ error: 'Respostas do Grit inválidas' }, 400);
    }
    result = scoreGrit(payload.answers);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server misconfigured' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: insertError } = await admin
    .from('profile_assessments')
    .insert({
      email,
      method,
      answers: payload.answers,
      result,
      consent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insertError || !created) {
    return jsonResponse({ error: insertError?.message ?? 'Falha ao salvar o teste' }, 500);
  }

  // LGPD: mutação em dado de candidato vira linha de auditoria.
  const { error: auditError } = await admin.from('audit_log').insert({
    company_id: null,
    actor_id: null,
    action: 'profile_assessment_submitted',
    entity_type: 'profile_assessment',
    entity_id: created.id,
    payload: { email, method },
  });
  if (auditError) {
    console.error('[submit-profile-assessment] audit_log:', auditError.message);
  }

  // Email consolidado com o resultado mais recente de cada método concluído.
  let emailed = false;
  if (emailConfigured()) {
    try {
      const { data: rows } = await admin
        .from('profile_assessments')
        .select('method, result, created_at')
        .eq('email', email)
        .order('created_at', { ascending: false });
      const byMethod: Partial<Record<AssessmentMethod, unknown>> = {};
      for (const row of rows ?? []) {
        const m = row.method as AssessmentMethod;
        if (!byMethod[m]) byMethod[m] = row.result;
      }
      const feitos = METHODS.filter((m) => byMethod[m])
        .map((m) => METHOD_INFO[m].label)
        .join(', ');
      const html = renderEmail({
        title: 'Sua análise de perfil comportamental',
        companyName: 'Noren',
        heading: 'Sua análise de perfil',
        paragraphs: [`Métodos concluídos até aqui: ${feitos}.`, ...resultParagraphs(byMethod)],
        button: { label: 'Ver meu perfil', url: 'https://appnoren.com/candidato' },
        secondaryNote:
          'Você recebeu este email porque concluiu um teste de perfil na Noren. O resultado fica no seu perfil de candidato.',
      });
      await sendEmail({
        to: email,
        subject: 'Sua análise de perfil comportamental',
        html,
        fromName: 'Noren',
      });
      emailed = true;
    } catch (err) {
      console.error('[submit-profile-assessment] email:', err);
    }
  }

  return jsonResponse({ ok: true, result, emailed });
});
