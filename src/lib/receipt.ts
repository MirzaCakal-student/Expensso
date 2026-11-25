import { isExpenseCategory, isPaymentMethod } from "./categories.ts";
import { parseAmount } from "./money.ts";
import { isValidDate } from "./summary.ts";

export type ReceiptDraft = {
  amount: number | null; // cents
  date: string | null;
  merchant: string;
  category: string;
  method: string | null;
};

/** Pulls the JSON object out of a model reply and validates every field. */
export function parseReceiptReply(reply: string): ReceiptDraft | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    amount: parseAmount(o.amount),
    date: isValidDate(o.date) ? o.date : null,
    merchant: typeof o.merchant === "string" ? o.merchant.trim().slice(0, 80) : "",
    category: isExpenseCategory(o.category) ? o.category : "other",
    method: isPaymentMethod(o.payment_method) ? o.payment_method : null,
  };
}
