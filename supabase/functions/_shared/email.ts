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
}): Promise<{ id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    throw new EmailError('RESEND_API_KEY não configurada nos secrets do Supabase', 500);
  }
  const from = Deno.env.get('EMAIL_FROM') || DEFAULT_FROM;

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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type EmailButton = { label: string; url: string };

// Monta o HTML do e-mail com a cara da Noren. Table-based e com estilos inline
// pra funcionar nos clientes de e-mail. Copy vem de quem chama (sem travessão).
export function renderEmail(opts: {
  title: string;
  heading: string;
  paragraphs: string[];
  button?: EmailButton;
  secondaryNote?: string;
  eyebrow?: string;
}): string {
  const paragraphs = opts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3a3a40;">${escapeHtml(
          p,
        )}</p>`,
    )
    .join('');

  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
         <tr><td style="border-radius:12px;background:#0f0f1a;">
           <a href="${escapeHtml(opts.button.url)}" target="_blank"
              style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
             ${escapeHtml(opts.button.label)}
           </a>
         </td></tr>
       </table>`
    : '';

  const secondary = opts.secondaryNote
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#8a8a8f;">${escapeHtml(
        opts.secondaryNote,
      )}</p>`
    : '';

  const eyebrow = opts.eyebrow
    ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0ea5e9;">${escapeHtml(
        opts.eyebrow,
      )}</p>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.title)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ececf1;overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#0ea5e9,#6366f1);"></td></tr>
        <tr>
          <td style="padding:32px 36px 8px;">
            <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0f0f1a;">Noren</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            ${eyebrow}
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.4px;color:#0f0f1a;">${escapeHtml(
              opts.heading,
            )}</h1>
            ${paragraphs}
            ${button}
            ${secondary}
          </td>
        </tr>
        <tr><td style="border-top:1px solid #f0f0f3;padding:20px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a8ad;">Você recebeu este e-mail porque se candidatou por meio da Noren. Se não foi você, é só ignorar.</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
