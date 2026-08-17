// Helper compartilhado pra chamar a API da OpenAI (Chat Completions).
// GPT-5 é modelo de reasoning: usa max_completion_tokens (não max_tokens),
// não aceita temperature != default, e aceita reasoning_effort.

export type OpenAIUsage = { input_tokens: number; output_tokens: number };

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'OpenAIError';
  }
}

export async function callOpenAI(args: {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens?: number;
  jsonMode?: boolean;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}): Promise<{ text: string; usage: OpenAIUsage }> {
  const body: Record<string, unknown> = {
    model: args.model,
    messages: [{ role: 'user', content: args.prompt }],
    max_completion_tokens: args.maxTokens ?? 4000,
  };
  if (args.jsonMode) body.response_format = { type: 'json_object' };
  if (args.reasoningEffort) body.reasoning_effort = args.reasoningEffort;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new OpenAIError(`OpenAI ${res.status}: ${errText.slice(0, 500)}`, res.status);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  const usage: OpenAIUsage = {
    input_tokens: data?.usage?.prompt_tokens ?? 0,
    output_tokens: data?.usage?.completion_tokens ?? 0,
  };
  return { text, usage };
}

// Transcrição de áudio. O arquivo passa por aqui e não é guardado em lugar
// nenhum: chega, vira texto, some.
//
// Tenta o modelo novo e cai pro whisper-1 se a conta não tiver acesso a ele.
// Sem esse fallback, uma conta antiga quebraria o botão de áudio inteiro com um
// erro de modelo desconhecido, que é o tipo de falha difícil de diagnosticar de
// dentro do formulário do candidato.
const TRANSCRIBE_MODELS = ['gpt-4o-transcribe', 'whisper-1'];

export async function transcribeAudio(args: {
  apiKey: string;
  audio: Blob;
  filename: string;
  language?: string;
}): Promise<{ text: string; modelUsed: string }> {
  let lastError: OpenAIError | null = null;

  for (const model of TRANSCRIBE_MODELS) {
    const form = new FormData();
    form.append('file', args.audio, args.filename);
    form.append('model', model);
    // Fixar o idioma melhora a transcrição e evita o modelo "traduzir" sozinho
    // um trecho em inglês no meio da fala.
    form.append('language', args.language ?? 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
    });

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any;
      return { text: String(data?.text ?? '').trim(), modelUsed: model };
    }

    const errText = await res.text();
    lastError = new OpenAIError(`OpenAI ${res.status}: ${errText.slice(0, 300)}`, res.status);
    // 400/404 costuma ser "modelo não existe pra esta conta": vale tentar o
    // próximo. Qualquer outro status é problema real e para aqui.
    if (res.status !== 400 && res.status !== 404) break;
  }

  throw lastError ?? new OpenAIError('Falha desconhecida na transcrição', 500);
}

// Custo em centavos de dólar. GPT-5: ~$1.25/1M input, ~$10/1M output.
export function openaiCostCents(usage: OpenAIUsage): number {
  return Math.round(((usage.input_tokens * 1.25 + usage.output_tokens * 10) / 1_000_000) * 100);
}
