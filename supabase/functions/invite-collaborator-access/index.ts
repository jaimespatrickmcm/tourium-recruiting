// Edge Function: invite-collaborator-access
// `invite` é uma ação privilegiada: somente owner da empresa do colaborador.
// `activate` é chamada pela própria pessoa depois de autenticar pelo magic link.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmail, sendEmail } from '../_shared/email.ts';

type Payload = {
  action?: 'invite' | 'activate';
  collaboratorId?: string;
  corporateEmail?: string;
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function appUrl(): string | null {
  const value = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(value) ? value : null;
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const value = forwarded?.split(',')[0].trim() || req.headers.get('cf-connecting-ip');
  return value || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado' }, 401);

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const publicAppUrl = appUrl();
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !publicAppUrl) {
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if ((body.action ?? 'invite') === 'activate') {
    const { data: matches, error: matchError } = await admin
      .from('collaborators')
      .select('id, company_id, pending_corporate_email, access_status')
      .eq('auth_user_id', userData.user.id)
      .eq('status', 'ativo')
      .is('employment_ended_at', null)
      .limit(2);

    if (matchError) return jsonResponse({ ok: false, error: 'Não conseguimos ativar o acesso' }, 500);
    if (!matches || matches.length !== 1) {
      return jsonResponse({ ok: false, error: 'Convite não encontrado ou indisponível' }, 403);
    }

    const collaborator = matches[0];
    const authenticatedEmail = (userData.user.email ?? '').trim().toLowerCase();
    const pendingEmail = (collaborator.pending_corporate_email ?? '').trim().toLowerCase();
    if (
      collaborator.access_status !== 'pending' ||
      !pendingEmail ||
      authenticatedEmail !== pendingEmail
    ) {
      return jsonResponse({ ok: false, error: 'Convite não encontrado ou indisponível' }, 403);
    }

    const { error: activateError } = await admin
      .from('collaborators')
      .update({
        corporate_email: pendingEmail,
        pending_corporate_email: null,
        access_status: 'active',
      })
      .eq('id', collaborator.id)
      .eq('auth_user_id', userData.user.id)
      .eq('access_status', 'pending');

    if (activateError) {
      return jsonResponse({ ok: false, error: 'Não conseguimos ativar o acesso' }, 500);
    }

    await admin.from('audit_log').insert({
      company_id: collaborator.company_id,
      actor_id: userData.user.id,
      action: 'collaborator.access.activate',
      entity_type: 'collaborator',
      entity_id: collaborator.id,
      payload: {},
      ip_address: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    });

    return jsonResponse({ ok: true });
  }

  const collaboratorId = (body.collaboratorId ?? '').trim();
  const corporateEmail = (body.corporateEmail ?? '').trim().toLowerCase();
  if (!collaboratorId) {
    return jsonResponse({ ok: false, error: 'collaboratorId obrigatório' }, 400);
  }
  if (!EMAIL_PATTERN.test(corporateEmail)) {
    return jsonResponse({ ok: false, error: 'E-mail corporativo inválido' }, 400);
  }

  const { data: owner, error: ownerError } = await admin
    .from('users')
    .select('company_id, role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (ownerError) return jsonResponse({ ok: false, error: 'Não conseguimos validar o acesso' }, 500);
  if (!owner?.company_id || owner.role !== 'owner') {
    return jsonResponse({ ok: false, error: 'Apenas o Admin pode enviar este convite' }, 403);
  }

  const { data: collaborator, error: collaboratorError } = await admin
    .from('collaborators')
    .select(
      'id, company_id, full_name, status, employment_ended_at, auth_user_id, corporate_email, pending_corporate_email, access_status',
    )
    .eq('id', collaboratorId)
    .maybeSingle();
  if (collaboratorError) {
    return jsonResponse({ ok: false, error: 'Não conseguimos localizar a pessoa' }, 500);
  }
  if (!collaborator) return jsonResponse({ ok: false, error: 'Pessoa não encontrada' }, 404);
  if (collaborator.company_id !== owner.company_id) {
    return jsonResponse({ ok: false, error: 'Sem acesso a esta pessoa' }, 403);
  }
  if (collaborator.status !== 'ativo' || collaborator.employment_ended_at) {
    return jsonResponse({ ok: false, error: 'O vínculo não está ativo' }, 409);
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: corporateEmail,
    options: { redirectTo: `${publicAppUrl}/pessoa` },
  });
  const authUserId = linkData.user?.id;
  const actionLink = linkData.properties?.action_link;
  if (linkError || !authUserId || !actionLink) {
    return jsonResponse({ ok: false, error: 'Não conseguimos preparar o convite' }, 500);
  }

  // Colaboradores não pertencem a public.users: essa tabela concede os claims
  // corporativos usados pelo painel de recrutamento. Rejeitamos a colisão para
  // que um owner/recruiter/viewer não seja reaproveitado como acesso pessoal.
  const { data: existingUser, error: existingUserError } = await admin
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle();
  if (existingUserError) {
    return jsonResponse({ ok: false, error: 'Não conseguimos preparar o perfil de acesso' }, 500);
  }
  if (existingUser) {
    return jsonResponse({ ok: false, error: 'Este e-mail já é usado por outro tipo de acesso' }, 409);
  }

  const { error: pendingError } = await admin
    .from('collaborators')
    .update({
      auth_user_id: authUserId,
      pending_corporate_email: corporateEmail,
      access_status: 'pending',
    })
    .eq('id', collaboratorId)
    .eq('company_id', owner.company_id);
  if (pendingError) {
    return jsonResponse({ ok: false, error: 'Não conseguimos preparar o convite' }, 500);
  }

  try {
    await sendEmail({
      to: corporateEmail,
      subject: 'Seu acesso ao Noren',
      html: renderEmail({
        title: 'Seu acesso ao Noren',
        companyName: 'Noren',
        heading: `Olá, ${collaborator.full_name}`,
        paragraphs: [
          'Seu acesso à área da pessoa foi criado. Use o botão abaixo para confirmar seu e-mail corporativo e entrar.',
          'Este convite é pessoal. Não encaminhe este e-mail.',
        ],
        button: { label: 'Confirmar meu acesso', url: actionLink },
        fallbackUrl: actionLink,
      }),
    });
  } catch {
    await admin
      .from('collaborators')
      .update({
        auth_user_id: collaborator.auth_user_id,
        corporate_email: collaborator.corporate_email,
        pending_corporate_email: collaborator.pending_corporate_email,
        access_status: collaborator.access_status,
      })
      .eq('id', collaboratorId)
      .eq('auth_user_id', authUserId);
    return jsonResponse({ ok: false, error: 'Não conseguimos enviar o convite' }, 502);
  }

  await admin.from('audit_log').insert({
    company_id: owner.company_id,
    actor_id: userData.user.id,
    action: 'collaborator.access.invite',
    entity_type: 'collaborator',
    entity_id: collaboratorId,
    payload: {},
    ip_address: clientIp(req),
    user_agent: req.headers.get('user-agent'),
  });

  return jsonResponse({ ok: true });
});
