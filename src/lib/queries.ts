import "server-only";
import { db } from "./db";
import { monthRange, shiftMonth, type Tx } from "./summary";

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function today(): string {
  const d = new Date();
  return `${currentMonth()}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthTransactions(userId: number, month: string): Tx[] {
  const [from, to] = monthRange(month);
  const rows = db()
    .prepare(
      `SELECT id, kind, amount, date, category, method, note FROM transactions
       WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC, id DESC`,
    )
    .all(userId, from, to);
  return rows.map((r) => ({ ...r })) as Tx[];
}

export type MonthTotals = { month: string; income: number; spent: number };

/** Income and spending for the `count` months ending at `month`. */
export function trend(userId: number, month: string, count = 6): MonthTotals[] {
  const first = shiftMonth(month, -(count - 1));
  const rows = db()
    .prepare(
      `SELECT substr(date, 1, 7) AS m, kind, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY m, kind`,
    )
    .all(userId, `${first}-01`, monthRange(month)[1]) as {
    m: string;
    kind: string;
    total: number;
  }[];
  return Array.from({ length: count }, (_, i) => {
    const m = shiftMonth(first, i);
    const pick = (k: string) => rows.find((r) => r.m === m && r.kind === k)?.total ?? 0;
    return { month: m, income: pick("income"), spent: pick("expense") };
  });
}

export function categoryTotals(userId: number, month: string): { category: string; total: number }[] {
  const [from, to] = monthRange(month);
  return db()
    .prepare(
      `SELECT category, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND kind = 'expense' AND date >= ? AND date < ?
       GROUP BY category ORDER BY total DESC`,
    )
    .all(userId, from, to)
    .map((r) => ({ ...r })) as { category: string; total: number }[];
}
