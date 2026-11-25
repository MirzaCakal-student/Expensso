import "server-only";

// Works with any OpenAI-compatible chat API (Gemini, Groq, OpenRouter, OpenAI).
// Configure in .env.local: AI_API_KEY, and optionally AI_BASE_URL and AI_MODEL.

export type AIPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type AIMessage = { role: "system" | "user" | "assistant"; content: string | AIPart[] };

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

export class AIError extends Error {}

const DEFAULT_MODELS = "gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-flash-latest";

function failureFor(status: number, model: string): AIError {
  if (status === 429) {
    return new AIError("The AI service's rate limit was reached. Wait a minute and try again.");
  }
  if (status === 404) {
    return new AIError(`The AI model "${model}" was not found. Check AI_MODEL in .env.local.`);
  }
  if (status === 503) {
    return new AIError("The AI service is overloaded right now. Try again in a minute.");
  }
  return new AIError(`The AI service returned an error (${status}). Try again.`);
}

export async function chatCompletion(messages: AIMessage[], maxTokens = 1200): Promise<string> {
  if (!aiConfigured()) {
    throw new AIError("AI is not set up yet. Add AI_API_KEY to .env.local and restart the app.");
  }
  const base = (
    process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai"
  ).replace(/\/+$/, "");
  // Several models can be listed, comma-separated. If one is overloaded, rate-limited
  // or too slow, the next one is tried.
  const models = (process.env.AI_MODEL ?? DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  let failure = new AIError("The AI service did not answer. Try again.");
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      failure = new AIError(
        "The AI service did not answer in time. Check your connection and try again.",
      );
      continue;
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`AI request to ${model} failed (${res.status}): ${detail}`);
      if (res.status === 401 || res.status === 403) {
        throw new AIError("The AI service rejected the API key. Check AI_API_KEY in .env.local.");
      }
      failure = failureFor(res.status, model);
      continue;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (text) return text;
    failure = new AIError("The AI service returned an empty reply. Try again.");
  }
  throw failure;
}

export function isImageDataUrl(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^data:image\/(jpeg|png|webp);base64,/.test(v) &&
    v.length < 6_000_000
  );
}
