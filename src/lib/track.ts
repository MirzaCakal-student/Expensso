import "server-only";
import { run } from "./db";

export type EventType = "view" | "login" | "signup" | "entry";

/** Records one usage event for the admin panel. Never breaks the request it measures. */
export async function track(userId: number | null, type: EventType): Promise<void> {
  try {
    await run("INSERT INTO events (user_id, type, at) VALUES (?, ?, ?)", [userId, type, Date.now()]);
  } catch (err) {
    console.error("Could not record usage event", err);
  }
}

export async function trackAI(entry: {
  userId: number | null;
  kind: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  ok: boolean;
}): Promise<void> {
  try {
    await run(
      `INSERT INTO ai_usage (user_id, kind, model, prompt_tokens, completion_tokens, ok, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.kind,
        entry.model,
        entry.promptTokens,
        entry.completionTokens,
        entry.ok ? 1 : 0,
        Date.now(),
      ],
    );
  } catch (err) {
    console.error("Could not record AI usage", err);
  }
}
