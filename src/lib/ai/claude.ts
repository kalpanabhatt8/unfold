/**
 * Shared Anthropic HTTP transport only — no prompts, validation, or fallbacks.
 * Each AI feature owns its model params and orchestration.
 */

export type ClaudeCallResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

export type ClaudeCallOptions = {
  model: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
};

export async function callAnthropicMessages(
  apiKey: string,
  options: ClaudeCallOptions,
): Promise<ClaudeCallResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      ...(options.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
      messages: [{ role: "user", content: options.prompt }],
    }),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return { ok: true, text: data.content?.[0]?.text?.trim() ?? "" };
}
