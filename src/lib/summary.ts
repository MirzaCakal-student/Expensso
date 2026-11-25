import { EXPENSE_CATEGORIES } from "./categories.ts";

export type Tx = {
  id: number;
  kind: "income" | "expense";
  amount: number; // cents
  date: string; // YYYY-MM-DD
  category: string;
  method: string | null;
  note: string;
};

export type Summary = {
  income: number;
  salary: number;
  side: number;
  spent: number;
  left: number;
  byCategory: { id: string; total: number }[];
  byMethod: { cash: number; card: number };
  byDay: { day: number; total: number }[];
};

export function isValidMonth(m: unknown): m is string {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function isValidDate(d: unknown): d is string {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + "T00:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [first day, first day of next month) */
export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${shiftMonth(month, 1)}-01`];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function summarize(txs: Tx[], month: string): Summary {
  let salary = 0;
  let side = 0;
  let spent = 0;
  const cat = new Map<string, number>();
  const byMethod = { cash: 0, card: 0 };
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: i + 1,
    total: 0,
  }));

  for (const t of txs) {
    if (t.kind === "income") {
      if (t.category === "salary") salary += t.amount;
      else side += t.amount;
      continue;
    }
    spent += t.amount;
    cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount);
    if (t.method === "cash") byMethod.cash += t.amount;
    else byMethod.card += t.amount;
    const day = Number(t.date.slice(8, 10));
    if (days[day - 1]) days[day - 1].total += t.amount;
  }

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    id: c.id as string,
    total: cat.get(c.id) ?? 0,
  }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const income = salary + side;
  return {
    income,
    salary,
    side,
    spent,
    left: income - spent,
    byCategory,
    byMethod,
    byDay: days,
  };
}
