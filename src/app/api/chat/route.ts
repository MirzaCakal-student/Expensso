import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { AIError, chatCompletion, isImageDataUrl, type AIMessage, type AIPart } from "@/lib/ai";
import { categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { categoryTotals, currentMonth, today, trend } from "@/lib/queries";
import { monthLabel } from "@/lib/summary";

async function spendingContext(userId: number): Promise<string> {
  const months = await trend(userId, currentMonth(), 3);
  const totals = await Promise.all(months.map((m) => categoryTotals(userId, m.month)));
  const lines = months.map((m, i) => {
    const cats = totals[i]
      .map((c) => `${categoryLabel(c.category)} ${formatMoney(c.total)}`)
      .join("; ");
    return `${monthLabel(m.month)}: income ${formatMoney(m.income)}, spent ${formatMoney(m.spent)}${
      cats ? ` (${cats})` : ""
    }`;
  });
  return lines.join("\n");
}

const MAX_BODY = 25_000_000;

type ClientMessage ={ role: "user" | "assistant"; text: string; image?: string };

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Log in again." }, { status: 401 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) {
    return NextResponse.json({ error: "That conversation is too large. Start a new one." }, { status: 413 });
  }
  const body = await req.json().catch(() => null);
  const incoming: ClientMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  // Only the newest photo is sent along; older ones would just resend megabytes.
  const lastImage = incoming.findLastIndex((m) => m?.role === "user" && m?.image);
  if (incoming.length === 0) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are the money assistant inside a personal expense tracker. The user lives in Bosnia and Herzegovina; amounts are in KM (BAM). Today is ${today()}.
Help them decide what is worth buying, compare products and prices from photos they send, and understand their own spending. Be direct and practical: give a clear recommendation and the reason, and say so when you cannot tell from a photo. Reply in plain text without Markdown, in the language the user writes in.

Their recent spending:
${await spendingContext(user.id)}`,
    },
  ];
  for (const [i, m] of incoming.entries()) {
    const text = String(m?.text ?? "").slice(0, 4000);
    if (m?.role === "assistant") {
      messages.push({ role: "assistant", content: text });
    } else {
      const parts: AIPart[] = [{ type: "text", text: text || "What do you think of this?" }];
      if (i === lastImage && isImageDataUrl(m?.image)) parts.push({ type: "image_url", image_url: { url: m.image } });
      messages.push({ role: "user", content: parts });
    }
  }

  try {
    return NextResponse.json({ reply: await chatCompletion(messages) });
  } catch (err) {
    const message = err instanceof AIError ? err.message : "The AI could not answer. Try again.";
    if (!(err instanceof AIError)) console.error(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
