import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, formatMoney } from "./money.ts";
import { summarize, shiftMonth, monthRange, isValidDate, type Tx } from "./summary.ts";
import { parseReceiptReply } from "./receipt.ts";

test("parseAmount handles dot, comma and thousands separators", () => {
  assert.equal(parseAmount("12"), 1200);
  assert.equal(parseAmount("12.5"), 1250);
  assert.equal(parseAmount("12,50"), 1250);
  assert.equal(parseAmount("1.234,50"), 123450);
  assert.equal(parseAmount("1,234.50"), 123450);
  assert.equal(parseAmount("1.234"), 123400);
  assert.equal(parseAmount("45,90 KM"), 4590);
  assert.equal(parseAmount(7.35), 735);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount(-5), null);
});

test("formatMoney", () => {
  assert.equal(formatMoney(123450), "1,234.50 KM");
  assert.equal(formatMoney(-500), "-5.00 KM");
});

test("month helpers", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.deepEqual(monthRange("2026-11"), ["2026-11-01", "2026-12-01"]);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-02-28"), true);
});

test("summarize splits income, categories, methods and days", () => {
  const tx = (p: Partial<Tx>): Tx => ({
    id: 1, kind: "expense", amount: 0, date: "2026-11-01",
    category: "other", method: "card", note: "", ...p,
  });
  const s = summarize(
    [
      tx({ kind: "income", category: "salary", amount: 200000, method: null }),
      tx({ kind: "income", category: "side", amount: 30000, method: null }),
      tx({ category: "food_shopping", amount: 5000, method: "cash", date: "2026-11-03" }),
      tx({ category: "food_shopping", amount: 2500, method: "card", date: "2026-11-03" }),
      tx({ category: "car", amount: 10000, method: "card", date: "2026-11-30" }),
    ],
    "2026-11",
  );
  assert.equal(s.income, 230000);
  assert.equal(s.salary, 200000);
  assert.equal(s.side, 30000);
  assert.equal(s.spent, 17500);
  assert.equal(s.left, 212500);
  assert.deepEqual(s.byCategory, [
    { id: "car", total: 10000 },
    { id: "food_shopping", total: 7500 },
  ]);
  assert.deepEqual(s.byMethod, { cash: 5000, card: 12500 });
  assert.equal(s.byDay.length, 30);
  assert.equal(s.byDay[2].total, 7500);
  assert.equal(s.byDay[29].total, 10000);
});

test("parseReceiptReply reads JSON wrapped in prose or code fences", () => {
  const r = parseReceiptReply(
    'Here you go:\n```json\n{"amount": "45,90", "date": "2026-11-12", "merchant": "Bingo", "category": "food_shopping", "payment_method": "card"}\n```',
  );
  assert.deepEqual(r, {
    amount: 4590, date: "2026-11-12", merchant: "Bingo",
    category: "food_shopping", method: "card",
  });
});

test("parseReceiptReply falls back safely on bad fields", () => {
  const r = parseReceiptReply('{"amount": null, "date": "12.11.2026", "category": "groceries"}');
  assert.deepEqual(r, { amount: null, date: null, merchant: "", category: "other", method: null });
  assert.equal(parseReceiptReply("I cannot read this image."), null);
  assert.equal(parseReceiptReply("{not json}"), null);
});
