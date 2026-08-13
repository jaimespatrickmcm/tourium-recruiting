// Helper compartilhado de e-mail (Resend) + template Noren.
// Envia via Resend API. Precisa dos secrets no Supabase:
//   RESEND_API_KEY  = chave da conta Resend
//   EMAIL_FROM      = remetente verificado, ex.: "Noren <recruiting@mail.appnoren.com>"
// Se RESEND_API_KEY não estiver setado, sendEmail lança erro claro (o chamador
// decide se isso bloqueia ou não a ação).

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Noren <recruiting@mail.appnoren.com>';

export class EmailError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'EmailError';
  }
}

export function emailConfigured(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY'));
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
}): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new EmailError('RESEND_API_KEY não configurada nos secrets do Supabase', 500);
  }
  const configured = Deno.env.get('EMAIL_FROM') || DEFAULT_FROM;
  // O e-mail vai em nome da empresa (o candidato se candidatou pra ela), mas
  // pelo endereço verificado da Noren.
  const from = opts.fromName ? withFromName(configured, opts.fromName) : configured;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new EmailError(`Resend ${res.status}: ${text.slice(0, 400)}`, res.status);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  return { id: String(data?.id ?? '') };
}

// Troca só o display name, mantendo o endereço verificado.
function withFromName(configured: string, name: string): string {
  const match = configured.match(/<([^>]+)>/);
  const address = match ? match[1] : configured;
  const clean = name.replace(/[<>"]/g, '').trim();
  return clean ? `${clean} <${address}>` : configured;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type EmailButton = { label: string; url: string };

const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Template da Noren: clean, centrado, responsivo. A marca de cima é a EMPRESA
// (é pra ela que a pessoa se candidatou); a Noren assina discreto no rodapé.
export function renderEmail(opts: {
  title: string;
  companyName: string;
  heading: string;
  paragraphs: string[];
  button?: EmailButton;
  imageUrl?: string;
  imageAlt?: string;
  secondaryNote?: string;
  fallbackUrl?: string;
}): string {
  const paragraphs = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-size:17px;line-height:1.6;color:#4a4a52;font-family:${FONT};">${escapeHtml(
          p,
        )}</p>`,
    )
    .join('');

  const image = opts.imageUrl
    ? `<img src="${escapeHtml(opts.imageUrl)}" alt="${escapeHtml(
        opts.imageAlt ?? '',
      )}" width="320" style="display:block;margin:0 auto 28px;width:100%;max-width:320px;height:auto;border:0;border-radius:16px;">`
    : '';

  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;">
         <tr><td align="center" style="border-radius:980px;background:#0f0f14;">
           <a href="${escapeHtml(opts.button.url)}" target="_blank"
              style="display:inline-block;padding:15px 40px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:980px;font-family:${FONT};">
             ${escapeHtml(opts.button.label)}
           </a>
         </td></tr>
       </table>`
    : '';

  // Plano B discreto: link curto em vez de despejar a URL crua (que ocupa três
  // linhas e destrói o visual). Continua sendo um link clicável de verdade.
  const fallback = opts.fallbackUrl
    ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#a1a1aa;font-family:${FONT};">
         Se o botão não funcionar,
         <a href="${escapeHtml(opts.fallbackUrl)}" target="_blank"
            style="color:#8a8a93;text-decoration:underline;">abra por aqui</a>.
       </p>`
    : '';

  const secondary = opts.secondaryNote
    ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#8a8a93;font-family:${FONT};">${escapeHtml(
        opts.secondaryNote,
      )}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.title)}</title>
<style>
  @media only screen and (max-width:600px) {
    .wrap { padding:20px 12px !important; }
    .card { border-radius:18px !important; }
    .pad { padding:32px 22px 34px !important; }
    .h1 { font-size:26px !important; }
    .p { font-size:16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    opts.title,
  )}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f7;">
  <tr>
    <td class="wrap" align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="max-width:520px;background:#ffffff;border-radius:22px;overflow:hidden;">
        <tr>
          <td class="pad" align="center" style="padding:44px 40px 46px;">

            <p style="margin:0 0 30px;font-size:15px;font-weight:600;letter-spacing:-0.1px;color:#0f0f14;font-family:${FONT};">${escapeHtml(
              opts.companyName,
            )}</p>

            ${image}

            <h1 class="h1" style="margin:0 0 20px;font-size:30px;line-height:1.18;font-weight:700;letter-spacing:-0.8px;color:#0f0f14;font-family:${FONT};">${escapeHtml(
              opts.heading,
            )}</h1>

            <div class="p" style="text-align:center;">${paragraphs}</div>

            ${button}
            ${secondary}
            ${fallback}

          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 40px 34px;">
            <div style="height:1px;background:#ededf0;margin:0 0 22px;"></div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#b4b4bb;font-family:${FONT};">
              Powered by <span style="color:#8a8a93;font-weight:600;">Noren</span>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
