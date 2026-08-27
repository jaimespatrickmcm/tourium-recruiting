// Edge Function: notify-stage-change
// Recrutador logado move um candidato de etapa no pipeline. Aqui a gente
// dispara a comunicação com o candidato: e-mail (Resend) com a cara da Noren e,
// quando dá, um link pronto de WhatsApp pro recrutador mandar na mão.
//
// Regras:
// - Valida JWT + ownership (a candidatura tem que ser da empresa do recrutador).
// - Copy voltada ao candidato NÃO menciona IA. Fala como se fosse o time da
//   empresa avaliando. Sem travessão.
// - Envio de e-mail é best-effort: se o Resend não está configurado ou falha, a
//   etapa já mudou no client, então a gente NÃO devolve erro. Só sinaliza
//   emailSent=false + emailError curto.
//
// Body: { applicationId, toStatus, origin }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendEmail, renderEmail, emailConfigured, type EmailButton } from '../_shared/email.ts';

type Payload = { applicationId?: string; toStatus?: string; origin?: string };

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

function generateToken(): string {
  // Dois UUIDs + entropia extra via getRandomValues. Bem mais que suficiente.
  const extra = new Uint8Array(16);
  crypto.getRandomValues(extra);
  const extraHex = Array.from(extra)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${crypto.randomUUID()}${crypto.randomUUID()}${extraHex}`.replace(/-/g, '');
}

function firstName(fullName: string | null): string {
  const name = (fullName ?? '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0];
}

// Monta o link de WhatsApp a partir do telefone do candidato. Só dígitos; se
// vier no formato BR local (10 ou 11 dígitos, sem código do país), prepende 55.
function buildWhatsappUrl(phone: string | null, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

type EmailSpec = {
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: EmailButton;
  secondaryNote?: string;
  imageUrl?: string;
  imageAlt?: string;
};

// GIF de comemoração no e-mail de contratação. Trocável por secret sem deploy.
const DEFAULT_HIRE_GIF = 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif';

// Copy por etapa. Voltada ao candidato, tom humano, PT-BR, sem travessão, sem
// citar IA. eyebrow (nome da empresa) é montado no chamador.
function composeEmail(args: {
  toStatus: string;
  companyName: string;
  jobTitle: string;
  candidateFirstName: string;
  formUrl: string | null;
  schedulingUrl: string | null;
}): EmailSpec | null {
  const { toStatus, companyName, jobTitle, candidateFirstName, formUrl, schedulingUrl } = args;
  const oi = candidateFirstName ? `Oi, ${candidateFirstName}!` : 'Oi!';

  if (toStatus === 'fit_cultural') {
    return {
      subject: `Você passou, ${candidateFirstName || 'boa notícia'}!`,
      heading: 'Você passou pra próxima',
      paragraphs: [
        `${oi} Seu perfil chamou atenção aqui pra vaga de ${jobTitle}.`,
        'Agora vem a parte boa: algumas perguntas pra gente te conhecer de verdade, além do currículo. São poucos minutos.',
      ],
      button: formUrl ? { label: 'Bora responder', url: formUrl } : undefined,
    };
  }

  if (toStatus === 'entrevista') {
    // O link da agenda vem do secret SCHEDULING_URL. O caminho sem link continua
    // existindo porque uma empresa nova pode nao ter agenda configurada ainda, e
    // e melhor avisar que o time entra em contato do que mandar um e-mail com um
    // botao que nao leva a lugar nenhum.
    const paragraphs = [
      `${oi} Sua conversa pra vaga de ${jobTitle} está marcada pra acontecer, só falta você escolher quando.`,
    ];
    if (schedulingUrl) {
      paragraphs.push(
        'Abre a agenda no botão abaixo e escolhe o horário que funciona pra você. Dá pra ver os dias livres e marcar em um minuto.',
      );
      // Duas frases que derrubam falta e ansiedade, nessa ordem: o que esperar
      // (ninguem gosta de entrar numa conversa sem saber o formato) e a saida
      // caso nenhum horario sirva. Sem isso o candidato some em vez de avisar.
      paragraphs.push(
        'É um papo pra gente se conhecer melhor: como você trabalha, o que te interessa na vaga e o que você quer saber da gente. Não precisa preparar nada.',
      );
      paragraphs.push(
        'Se nenhum horário encaixar, responde este e-mail que a gente acha outro jeito.',
      );
    } else {
      paragraphs.push(
        'Em seguida mandamos o link pra você escolher um horário que caiba na sua agenda. Fica de olho aqui.',
      );
    }
    return {
      subject: `${candidateFirstName || 'Oi'}, escolhe o melhor horário pra gente conversar`,
      heading: 'Bora bater um papo',
      paragraphs,
      button: schedulingUrl ? { label: 'Escolher horário', url: schedulingUrl } : undefined,
    };
  }

  if (toStatus === 'proposta') {
    return {
      subject: `Novidade boa sobre a vaga de ${jobTitle}`,
      heading: 'A gente quer você aqui',
      paragraphs: [
        `${oi} Depois das conversas, a decisão foi fácil: queremos seguir com você pra vaga de ${jobTitle}.`,
        'Já já a gente te chama pra alinhar os detalhes da proposta. Qualquer dúvida no caminho, é só responder aqui.',
      ],
    };
  }

  if (toStatus === 'contratado') {
    return {
      subject: `É oficial: bem-vindo ao time da ${companyName}!`,
      heading: 'Deu bom, você é da casa',
      paragraphs: [
        `${oi} É oficial! Você faz parte do time da ${companyName} como ${jobTitle}.`,
        'Em breve mandamos os próximos passos pra você começar. Preparamos um cantinho aqui, mal podemos esperar.',
      ],
      imageUrl: Deno.env.get('HIRE_GIF_URL') || DEFAULT_HIRE_GIF,
      imageAlt: 'Comemoração de boas-vindas',
    };
  }

  if (toStatus === 'reprovado') {
    return {
      subject: `Sobre sua candidatura na ${companyName}`,
      heading: 'Uma resposta sincera',
      paragraphs: [
        `${oi} Obrigado de verdade pelo tempo que você dedicou ao processo da vaga de ${jobTitle}.`,
        'Dessa vez não vamos seguir. A escolha foi difícil e não diz nada sobre o valor do seu trabalho, foi mais sobre o momento e o que a vaga pede agora.',
        'Guardamos seu contato pra quando aparecer algo com a sua cara. Boa sorte por aí.',
      ],
    };
  }

  // triagem e qualquer outra etapa: sem e-mail.
  return null;
}

// Mensagem curta de WhatsApp por etapa. Tom pessoal, primeira pessoa do time.
function composeWhatsapp(args: {
  toStatus: string;
  companyName: string;
  jobTitle: string;
  candidateFirstName: string;
  formUrl: string | null;
  schedulingUrl: string | null;
}): string | null {
  const { toStatus, companyName, jobTitle, candidateFirstName, formUrl, schedulingUrl } = args;
  const oi = candidateFirstName ? `Oi, ${candidateFirstName}!` : 'Oi!';

  switch (toStatus) {
    case 'fit_cultural':
      return `${oi} Aqui é do time da ${companyName}. Você passou pra próxima etapa da vaga de ${jobTitle}. O próximo passo é um formulário rápido pra gente te conhecer melhor.${
        formUrl ? ` Dá pra preencher por aqui: ${formUrl}` : ''
      }`;
    case 'entrevista':
      // Com agenda configurada, mandar o link em vez de perguntar horário: duas
      // vias diferentes pro mesmo passo (e-mail com agenda, WhatsApp pedindo
      // disponibilidade) fazem o candidato responder no WhatsApp um horário que
      // a agenda talvez não tenha, e alguém do time vira intermediário à toa.
      return `${oi} Aqui é do time da ${companyName}. Gostamos do seu perfil pra vaga de ${jobTitle} e queremos marcar uma conversa.${
        schedulingUrl
          ? ` Escolhe o melhor horário por aqui: ${schedulingUrl}`
          : ' Qual o melhor dia e horário pra você?'
      }`;
    case 'proposta':
      return `${oi} Aqui é do time da ${companyName}. Temos uma boa notícia sobre a vaga de ${jobTitle}: queremos seguir com você. Em breve alinhamos os detalhes da proposta.`;
    case 'contratado':
      return `${oi} Aqui é do time da ${companyName}. É oficial, você faz parte do time na vaga de ${jobTitle}. Seja muito bem-vindo! Em breve mandamos os próximos passos.`;
    case 'reprovado':
      return `${oi} Aqui é do time da ${companyName}. Obrigado pela dedicação no processo da vaga de ${jobTitle}. Dessa vez a gente não vai seguir, mas guardamos seu contato pra futuras oportunidades. Te desejo tudo de bom!`;
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não permitido' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const applicationId = (payload.applicationId ?? '').trim();
  const toStatus = (payload.toStatus ?? '').trim();
  // linkOnly: o recrutador só quer o link pra mandar na mão (o candidato não
  // achou o e-mail, caiu em spam, trocou de endereço). Gera o link e NÃO envia
  // e-mail. Sem isso, pegar o link de novo significaria disparar outro e-mail
  // pro candidato, que é exatamente o que já não funcionou.
  const linkOnly = payload.linkOnly === true;
  // O link que vai pro candidato precisa ser o endereço público de produção.
  // APP_URL manda; o origin do navegador é só plano B (senão vaza localhost).
  const configuredAppUrl = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '');
  const browserOrigin = (payload.origin ?? '').trim().replace(/\/+$/, '');
  const origin = configuredAppUrl || browserOrigin;

  if (!applicationId) return jsonResponse({ error: 'applicationId obrigatório' }, 400);
  if (!toStatus) return jsonResponse({ error: 'toStatus obrigatório' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // 1) Quem é o recrutador (via JWT) e qual empresa.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'JWT inválido' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userRow } = await admin
    .from('users')
    .select('company_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  const companyId = userRow?.company_id;
  if (!companyId) return jsonResponse({ error: 'Usuário sem empresa vinculada' }, 403);

  // 2) Candidatura + ownership.
  const { data: application } = await admin
    .from('applications')
    .select('id, candidate_name, candidate_email, candidate_phone, city, job_id, company_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (!application) return jsonResponse({ error: 'Candidatura não encontrada' }, 404);
  if (application.company_id !== companyId) {
    return jsonResponse({ error: 'Candidatura não pertence à empresa' }, 403);
  }

  // 3) Vaga + empresa (slugs pra montar o link do form).
  const { data: job } = await admin
    .from('jobs')
    .select('slug, title')
    .eq('id', application.job_id)
    .maybeSingle();
  const { data: company } = await admin
    .from('companies')
    .select('slug, name')
    .eq('id', companyId)
    .maybeSingle();

  const companyName = company?.name ?? 'a empresa';
  const companySlug = company?.slug ?? '';
  const jobSlug = job?.slug ?? '';
  const jobTitle = job?.title ?? 'a vaga';
  const candidateFirstName = firstName(application.candidate_name);
  const candidateEmail = (application.candidate_email ?? '').trim();

  // 4) Se for fit_cultural, mint token pro form individual do candidato.
  let formUrl: string | null = null;
  const wantsFormLink = toStatus === 'fit_cultural' || (linkOnly && toStatus === 'triagem');
  if (wantsFormLink && candidateEmail && origin && companySlug && jobSlug) {
    try {
      const token = generateToken();
      const tokenHash = await sha256Hex(token);
      const { error: tokenError } = await admin
        .from('applicant_tokens')
        .insert({ email: candidateEmail, token_hash: tokenHash });
      if (tokenError) throw tokenError;
      formUrl = `${origin}/careers/${companySlug}/${jobSlug}/form?app=${applicationId}&t=${token}`;
    } catch (err) {
      console.error('[notify-stage-change] token mint error:', err);
      formUrl = null;
    }
  }

  const schedulingUrl = Deno.env.get('SCHEDULING_URL') || null;

  // 5) Compõe e tenta enviar o e-mail (best-effort).
  const spec = composeEmail({
    toStatus,
    companyName,
    jobTitle,
    candidateFirstName,
    formUrl,
    schedulingUrl,
  });

  let emailSent = false;
  let emailError: string | null = null;

  if (spec && candidateEmail && !linkOnly) {
    if (!emailConfigured()) {
      emailError = 'E-mail ainda não configurado';
    } else {
      try {
        const html = renderEmail({
          title: spec.subject,
          companyName,
          heading: spec.heading,
          paragraphs: spec.paragraphs,
          button: spec.button,
          imageUrl: spec.imageUrl,
          imageAlt: spec.imageAlt,
          secondaryNote: spec.secondaryNote,
          // Link cru só quando existe botão de form, como plano B.
          fallbackUrl: spec.button && formUrl ? formUrl : undefined,
        });
        // Chega em nome da empresa, pelo endereço verificado da Noren.
        await sendEmail({
          to: candidateEmail,
          subject: spec.subject,
          html,
          fromName: companyName,
        });
        emailSent = true;
      } catch (err) {
        emailSent = false;
        emailError = err instanceof Error ? err.message.slice(0, 200) : 'Falha no envio';
        console.error('[notify-stage-change] email error:', err);
      }
    }
  }

  // 6) Link de WhatsApp pro recrutador mandar na mão.
  const whatsappMessage = composeWhatsapp({
    schedulingUrl,
    toStatus,
    companyName,
    jobTitle,
    candidateFirstName,
    formUrl,
  });
  const whatsappUrl = whatsappMessage
    ? buildWhatsappUrl(application.candidate_phone, whatsappMessage)
    : null;

  return jsonResponse({
    ok: true,
    emailSent,
    emailError,
    formUrl,
    // Vai no retorno pra o botão "copiar link da etapa" achar o link da agenda
    // quando o candidato já está em entrevista.
    schedulingUrl,
    whatsappUrl,
    toStatus,
  });
});
