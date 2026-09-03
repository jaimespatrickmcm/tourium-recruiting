// Edge Function: invite-review-assignment
// Envia o acesso de uma avaliação para um participante. O convite só pode ser
// criado pelo owner da empresa ou pela própria pessoa avaliada.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmail, sendEmail } from '../_shared/email.ts';

type Relationship = 'self' | 'manager' | 'peer' | 'direct_report' | 'other';
type Payload = { reviewId?: string; evaluatorEmail?: string; relationship?: Relationship };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RELATIONSHIPS: Relationship[] = ['self', 'manager', 'peer', 'direct_report', 'other'];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado' }, 401);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }

  const reviewId = (body.reviewId ?? '').trim();
  const evaluatorEmail = (body.evaluatorEmail ?? '').trim().toLowerCase();
  const relationship = body.relationship ?? 'other';
  if (!reviewId) return jsonResponse({ ok: false, error: 'reviewId obrigatório' }, 400);
  if (!EMAIL_PATTERN.test(evaluatorEmail)) {
    return jsonResponse({ ok: false, error: 'E-mail do participante inválido' }, 400);
  }
  if (!RELATIONSHIPS.includes(relationship)) {
    return jsonResponse({ ok: false, error: 'Relação inválida' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const publicAppUrl = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '');
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !/^https?:\/\//.test(publicAppUrl)) {
    return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ ok: false, error: 'JWT inválido' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: review, error: reviewError } = await admin
    .from('performance_reviews')
    .select('id, company_id, collaborator_id, title, review_date, status')
    .eq('id', reviewId)
    .maybeSingle();
  if (reviewError) return jsonResponse({ ok: false, error: 'Não conseguimos localizar a avaliação' }, 500);
  if (!review) return jsonResponse({ ok: false, error: 'Avaliação não encontrada' }, 404);
  if (review.status !== 'open') {
    return jsonResponse({ ok: false, error: 'Abra a avaliação antes de convidar participantes' }, 409);
  }

  const [{ data: actor }, { data: collaborator }, { data: company }] = await Promise.all([
    admin.from('users').select('company_id, role').eq('id', userData.user.id).maybeSingle(),
    admin
      .from('collaborators')
      .select('id, full_name, auth_user_id, access_status, status')
      .eq('id', review.collaborator_id)
      .maybeSingle(),
    admin.from('companies').select('name').eq('id', review.company_id).maybeSingle(),
  ]);

  if (!collaborator) return jsonResponse({ ok: false, error: 'Pessoa avaliada não encontrada' }, 404);
  const isOwner = actor?.company_id === review.company_id && actor.role === 'owner';
  const isSelf =
    collaborator.auth_user_id === userData.user.id &&
    collaborator.access_status === 'active' &&
    collaborator.status === 'ativo';
  if (!isOwner && !isSelf) return jsonResponse({ ok: false, error: 'Sem acesso a esta avaliação' }, 403);

  // A primeira geração resolve ou cria o auth user. O link é descartado porque
  // o redirect final precisa incluir o ID da assignment, ainda não conhecido.
  const { data: bootstrapLink, error: bootstrapError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: evaluatorEmail,
    options: { redirectTo: `${publicAppUrl}/avaliacao/360` },
  });
  const evaluatorUserId = bootstrapLink.user?.id;
  if (bootstrapError || !evaluatorUserId) {
    return jsonResponse({ ok: false, error: 'Não conseguimos preparar o convite' }, 500);
  }

  const { data: existing, error: existingError } = await admin
    .from('review_assignments')
    .select('id, status')
    .eq('review_id', reviewId)
    .eq('evaluator_user_id', evaluatorUserId)
    .maybeSingle();
  if (existingError) return jsonResponse({ ok: false, error: 'Não conseguimos preparar o convite' }, 500);
  if (existing?.status === 'submitted') {
    return jsonResponse({ ok: false, error: 'Esta pessoa já respondeu a avaliação' }, 409);
  }

  let assignmentId = existing?.id ?? null;
  if (assignmentId) {
    const { error: updateError } = await admin
      .from('review_assignments')
      .update({ evaluator_email: evaluatorEmail, relationship })
      .eq('id', assignmentId)
      .eq('review_id', reviewId);
    if (updateError) return jsonResponse({ ok: false, error: 'Não conseguimos atualizar o convite' }, 500);
  } else {
    const { data: created, error: createError } = await admin
      .from('review_assignments')
      .insert({
        company_id: review.company_id,
        review_id: reviewId,
        evaluator_user_id: evaluatorUserId,
        evaluator_email: evaluatorEmail,
        relationship,
      })
      .select('id')
      .single();
    if (createError || !created) {
      return jsonResponse({ ok: false, error: 'Não conseguimos criar o convite' }, 409);
    }
    assignmentId = created.id;
  }

  if (!assignmentId) {
    return jsonResponse({ ok: false, error: 'Não conseguimos preparar o convite' }, 500);
  }

  const redirectTo = `${publicAppUrl}/avaliacao/360?assignment=${encodeURIComponent(assignmentId)}`;
  const { data: finalLink, error: finalLinkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: evaluatorEmail,
    options: { redirectTo },
  });
  const actionLink = finalLink.properties?.action_link;
  if (finalLinkError || !actionLink || finalLink.user?.id !== evaluatorUserId) {
    return jsonResponse({ ok: false, error: 'Não conseguimos gerar o link da avaliação' }, 500);
  }

  try {
    await sendEmail({
      to: evaluatorEmail,
      subject: `Você foi convidado para ${review.title}`,
      html: renderEmail({
        title: 'Convite para avaliação',
        companyName: company?.name ?? 'Noren',
        heading: 'Sua participação foi solicitada',
        paragraphs: [
          `${collaborator.full_name} convidou você para participar da avaliação “${review.title}”.`,
          'As respostas ficam identificadas nesta versão. Abra o formulário para conferir os critérios e enviar sua avaliação.',
        ],
        button: { label: 'Responder avaliação', url: actionLink },
        fallbackUrl: actionLink,
      }),
    });
  } catch (error) {
    console.error(
      'invite-review-assignment email send failed',
      error instanceof Error ? error.message : 'unknown error',
    );
    return jsonResponse({ ok: false, error: 'Não conseguimos enviar o convite' }, 502);
  }

  return jsonResponse({ ok: true, assignmentId });
});
