import { supabase } from '@/lib/supabase';

// Wrapper de supabase.functions.invoke que extrai a mensagem REAL do erro.
// Quando a edge function responde non-2xx, o supabase-js devolve um
// FunctionsHttpError cujo .message é sempre o genérico "Edge Function returned
// a non-2xx status code". O motivo de verdade fica no corpo (error.context).
// Aqui a gente lê esse corpo e devolve um Error com a mensagem certa.
// Também trata o caso de a função responder 200 com { ok: false, error }.
export async function invokeEdge<T = unknown>(
  name: string,
  body?: unknown,
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke(name, body ? { body } : undefined);

  if (error) {
    let message = error.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json();
        if (parsed?.error) message = String(parsed.error);
      } catch {
        // corpo não era JSON ou já foi consumido: mantém a mensagem que temos
      }
    }
    return { data: null, error: new Error(message) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (d && d.ok === false) {
    return { data: null, error: new Error(d.error ?? 'Falha na operação') };
  }

  return { data: (data as T) ?? null, error: null };
}
