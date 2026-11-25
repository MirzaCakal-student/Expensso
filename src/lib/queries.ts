import "server-only";
import { all } from "./db";
import { monthRange, shiftMonth, type Tx } from "./summary";

// The app is used from Bosnia; on a server in another timezone "today" must
// still be the local date.
const TZ = process.env.APP_TIMEZONE ?? "Europe/Sarajevo";

export function today(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export async function monthTransactions(userId: number, month: string): Promise<Tx[]> {
  const [from, to] = monthRange(month);
  return all<Tx>(
    `SELECT id, kind, amount, date, category, method, note FROM transactions
     WHERE user_id = ? AND date >= ? AND date < ? ORDER BY date DESC, id DESC`,
    [userId, from, to],
  );
}

export type MonthTotals = { month: string; income: number; spent: number };

/** Income and spending for the `count` months ending at `month`. */
export async function trend(userId: number, month: string, count = 6): Promise<MonthTotals[]> {
  const first = shiftMonth(month, -(count - 1));
  const rows = await all<{ m: string; kind: string; total: number }>(
    `SELECT substr(date, 1, 7) AS m, kind, SUM(amount) AS total FROM transactions
     WHERE user_id = ? AND date >= ? AND date < ? GROUP BY m, kind`,
    [userId, `${first}-01`, monthRange(month)[1]],
  );
  return Array.from({ length: count }, (_, i) => {
    const m = shiftMonth(first, i);
    const pick = (k: string) => rows.find((r) => r.m === m && r.kind === k)?.total ?? 0;
    return { month: m, income: pick("income"), spent: pick("expense") };
  });
}

export async function categoryTotals(
  userId: number,
  month: string,
): Promise<{ category: string; total: number }[]> {
  const [from, to] = monthRange(month);
  return all<{ category: string; total: number }>(
    `SELECT category, SUM(amount) AS total FROM transactions
     WHERE user_id = ? AND kind = 'expense' AND date >= ? AND date < ?
     GROUP BY category ORDER BY total DESC`,
    [userId, from, to],
  );
}
