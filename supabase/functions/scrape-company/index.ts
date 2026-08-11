// Edge Function: scrape-company
// Recebe { url } e devolve { name, description, og_image } extraídos do site.
// Sem AI nessa versão — só extração de meta tags. AI/enrichment futuro.

import { corsHeaders } from '../_shared/cors.ts';

type Payload = { url: string };

type Scraped = {
  name?: string;
  description?: string;
  og_image?: string;
  site_name?: string;
};

function pickMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    // <meta property="og:title" content="Foo">
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
      'i',
    );
    const m = html.match(re);
    if (m) return decodeEntities(m[1].trim());
    // <meta content="Foo" property="og:title">
    const re2 = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:property|name)\\s*=\\s*["']${name}["']`,
      'i',
    );
    const m2 = html.match(re2);
    if (m2) return decodeEntities(m2[1].trim());
  }
  return undefined;
}

function pickTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizeUrl(input: string): string | null {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.port && u.port !== '80' && u.port !== '443') return null;
    if (isBlockedHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Anti-SSRF: bloqueia alvos internos/reservados. Não cobre DNS rebinding,
// mas fecha localhost, rede privada e metadata endpoints.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) return true; // IPv6 literal: bloqueia por simplicidade
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a >= 224) return true;
  }
  return false;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const url = normalizeUrl(payload.url ?? '');
  if (!url) {
    return jsonResponse({ error: 'URL inválida' }, 400);
  }

  try {
    // Redirects manuais pra validar cada hop contra a blocklist de SSRF.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let currentUrl = url;
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NorenBot/1.0; +https://noren.app)',
        },
      });
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get('location');
      if (!next) break;
      const normalizedNext = normalizeUrl(new URL(next, currentUrl).toString());
      if (!normalizedNext) {
        clearTimeout(timeout);
        return jsonResponse({ error: 'URL inválida' }, 400);
      }
      currentUrl = normalizedNext;
      res = null;
    }
    clearTimeout(timeout);
    if (!res) {
      return jsonResponse({ error: 'Redirecionamentos demais' }, 200);
    }
    if (!res.ok) {
      return jsonResponse({ error: `Site retornou ${res.status}` }, 200);
    }

    const html = (await res.text()).slice(0, 200_000);

    const scraped: Scraped = {
      name:
        pickMeta(html, ['og:site_name', 'application-name', 'apple-mobile-web-app-title']) ??
        pickMeta(html, ['og:title', 'twitter:title']) ??
        pickTitle(html),
      description:
        pickMeta(html, ['og:description', 'twitter:description', 'description']) ?? undefined,
      og_image: pickMeta(html, ['og:image', 'twitter:image']),
      site_name: pickMeta(html, ['og:site_name']),
    };

    return jsonResponse({ ok: true, url, scraped });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar URL';
    return jsonResponse({ ok: false, error: message }, 200);
  }
});
