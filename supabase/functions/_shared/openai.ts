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

// Custo em centavos de dólar. GPT-5: ~$1.25/1M input, ~$10/1M output.
export function openaiCostCents(usage: OpenAIUsage): number {
  return Math.round(((usage.input_tokens * 1.25 + usage.output_tokens * 10) / 1_000_000) * 100);
}
