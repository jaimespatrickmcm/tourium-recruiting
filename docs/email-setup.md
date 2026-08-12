# E-mails da Noren: setup (Resend + Supabase Auth)

Guia único pra deixar os e-mails com a cara da Noren e saindo pelo domínio `recruiting@mail.appnoren.com`. Duas frentes:

1. **E-mails transacionais** (viradas de etapa: fit cultural, entrevista, proposta, contratado, reprovado) saem pelo helper `_shared/email.ts` via Resend. Precisam de 2 secrets no Supabase.
2. **E-mail de login/OTP** (Supabase Auth) usa SMTP customizado apontando pro Resend + um template com a marca (abaixo).

---

## Parte 0: Resend (uma vez)

1. Em [resend.com](https://resend.com), adicione e **verifique o domínio** `mail.appnoren.com` (registros SPF/DKIM que o Resend mostra, colados no DNS do domínio).
2. Crie uma **API key**. Guarde, ela vira o `RESEND_API_KEY`.
3. Remetente que vamos usar: `recruiting@mail.appnoren.com` (nome de exibição "Noren").

---

## Parte 1: Secrets no Supabase (transacionais)

Supabase Dashboard do projeto `dknakecjaakbssuqxsjf` → **Edge Functions → Secrets** (ou via CLI). Defina:

```
RESEND_API_KEY = <a key do Resend>
EMAIL_FROM     = Noren <recruiting@mail.appnoren.com>
```

E o endereço público do app, que é o que vai nos links enviados ao candidato:

```
APP_URL = https://appnoren.com
```

Sem `APP_URL`, o link cai no endereço de onde o recrutador estava navegando (em desenvolvimento isso vira `localhost`, que não abre na máquina do candidato).

Opcionais (viram ativos quando setados):

```
SCHEDULING_URL = <link da agenda>        # CTA "Escolher horário" no e-mail de entrevista
HIRE_GIF_URL   = <url de um gif>         # troca o gif de comemoração do e-mail de contratação
SUBMIT_RATE_LIMIT_MAX = 3                 # religa o rate limit do form público
```

Sem `RESEND_API_KEY`, as funções não quebram: a virada de etapa acontece e o e-mail apenas não sai (o app avisa "e-mail ainda não configurado"). Setou a key, passa a enviar.

Via CLI (alternativa ao painel):

```bash
supabase secrets set RESEND_API_KEY=xxx "EMAIL_FROM=Noren <recruiting@mail.appnoren.com>" --project-ref dknakecjaakbssuqxsjf
```

---

## Parte 2: E-mail de login/OTP com a marca

O e-mail de login hoje usa o template default do Supabase. Dois passos pra deixar bonito e sair pelo domínio da Noren.

### 2a. SMTP customizado (pra sair como recruiting@)

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → **Enable Custom SMTP**:

```
Sender email:  recruiting@mail.appnoren.com
Sender name:   Noren
Host:          smtp.resend.com
Port:          465
Username:      resend
Password:      <o mesmo RESEND_API_KEY>
```

Sem isso, o Supabase manda pelo servidor default dele (com limites baixos e domínio genérico).

### 2b. Template do e-mail

Supabase Dashboard → **Authentication → Emails → Templates**. A Noren usa **código OTP** no login (a tela pede os 6 dígitos), então edite o template que o seu fluxo dispara (normalmente **Magic Link**) e cole o HTML abaixo. A variável do código é `{{ .Token }}`. Se em algum fluxo você usar link em vez de código, troque o bloco do código por um botão apontando pra `{{ .ConfirmationURL }}`.

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Seu código de acesso Noren</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;border:1px solid #ececf1;overflow:hidden;">
      <tr><td style="height:4px;background:linear-gradient(90deg,#0ea5e9,#6366f1);"></td></tr>
      <tr><td style="padding:32px 36px 8px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#0f0f1a;">Noren</td></tr>
      <tr><td style="padding:8px 36px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0ea5e9;">Acesso à sua conta</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.4px;color:#0f0f1a;">Seu código de entrada</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#3a3a40;">Use o código abaixo pra entrar. Ele vale por pouco tempo, então é bom usar logo.</p>
        <div style="margin:0 0 20px;padding:18px 24px;background:#f4f5f7;border:1px solid #ececf1;border-radius:14px;text-align:center;font-size:34px;font-weight:800;letter-spacing:8px;color:#0f0f1a;">{{ .Token }}</div>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#8a8a8f;">Se não foi você que pediu, pode ignorar este e-mail. Ninguém entra sem o código.</p>
      </td></tr>
      <tr><td style="border-top:1px solid #f0f0f3;padding:20px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#a8a8ad;">Noren, seu recrutamento com contexto.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
```

Faça o mesmo (marca + cores) nos templates de **Confirm signup** e **Reset password** se/quando forem usados, trocando o miolo pelo botão de `{{ .ConfirmationURL }}`.

---

## Checklist rápido

- [ ] Domínio `mail.appnoren.com` verificado no Resend.
- [ ] `RESEND_API_KEY` e `EMAIL_FROM` setados nos secrets do Supabase.
- [ ] SMTP customizado ligado em Authentication (host smtp.resend.com, user resend).
- [ ] Template de login colado com `{{ .Token }}`.
- [ ] Teste: login (recebe o código pelo domínio da Noren) e avançar um candidato pra Fit cultural (recebe o e-mail com o link do form).
