import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { AIError, chatCompletion, isImageDataUrl } from "@/lib/ai";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { parseReceiptReply } from "@/lib/receipt";

const PROMPT = `You read photos of shop receipts and invoices, mostly from Bosnia and Herzegovina (amounts in KM/BAM).
Reply with ONLY a JSON object, no other text:
{"amount": number, "date": "YYYY-MM-DD" or null, "merchant": string, "category": string, "payment_method": "cash" | "card" | null}

- amount: the final total actually paid (look for UKUPNO, ZA UPLATU, TOTAL, IZNOS), as a number with a dot for decimals. Use null if you cannot read it. Never guess.
- date: the purchase date printed on the receipt, or null.
- merchant: the shop or company name.
- category: exactly one of ${EXPENSE_CATEGORIES.map((c) => `"${c.id}" (${c.label})`).join(", ")}.
  Supermarkets and groceries are food_shopping; restaurants, bakeries, cafes and delivery are eating_out; fuel, parts, service, registration and parking are car; bars and clubs are going_out; cinema, games and subscriptions are entertainment; tuition, books, stationery and other study costs are school.
- payment_method: "card" if the receipt shows a card payment (KARTICA, VISA, MASTERCARD), "cash" if it shows GOTOVINA, otherwise null.`;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Log in again." }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 8_000_000) {
    return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  }
  const body = await req.json().catch(() => null);
  if (!isImageDataUrl(body?.image)) {
    return NextResponse.json({ error: "That file is not a usable photo. Try again." }, { status: 400 });
  }
  try {
    const reply = await chatCompletion(
      [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this receipt." },
            { type: "image_url", image_url: { url: body.image } },
          ],
        },
      ],
      400,
      { userId: user.id, kind: "scan" },
    );
    const draft = parseReceiptReply(reply);
    if (!draft) {
      return NextResponse.json(
        { error: "The receipt could not be read. Retake the photo in better light, or enter it by hand." },
        { status: 422 },
      );
    }
    return NextResponse.json(draft);
  } catch (err) {
    const message = err instanceof AIError ? err.message : "Could not read the receipt. Try again.";
    if (!(err instanceof AIError)) console.error(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
