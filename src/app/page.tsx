import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { categoryColor, categoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { currentMonth, monthTransactions, today, trend } from "@/lib/queries";
import { isValidMonth, monthLabel, shiftMonth, summarize } from "@/lib/summary";
import { Charts } from "@/components/Charts";
import { Ledger } from "@/components/Ledger";
import { SalaryBar } from "@/components/SalaryBar";
import { PasskeySetup } from "@/components/Passkey";
import { passkeyCount } from "@/lib/passkeys";
import { AdSlot } from "@/components/AdSlot";
import { track } from "@/lib/track";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const [txs, passkeys] = await Promise.all([
    monthTransactions(user.id, month),
    passkeyCount(user.id),
    track(user.id, "view"),
  ]);
  const s = summarize(txs, month);
  const label = monthLabel(month);
  const monthName = label.split(" ")[0];
  const categories = s.byCategory.map((c) => ({
    ...c,
    label: categoryLabel(c.id),
    color: categoryColor(c.id),
  }));
  const months = (await trend(user.id, month)).map((m) => ({
    ...m,
    label: monthLabel(m.month).slice(0, 3),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <span className="font-display text-xl font-bold tracking-tight">Expensso</span>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {user.role === "admin" && (
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-card">
              Admin
            </Link>
          )}
          <Link href="/chat" className="rounded-lg px-3 py-2 hover:bg-card">
            Ask AI
          </Link>
          <form action={logout}>
            <button className="cursor-pointer rounded-lg px-3 py-2 text-muted hover:bg-card">
              Log out
            </button>
          </form>
        </nav>
      </header>

      <section className="rounded-3xl bg-ink p-5 text-white sm:p-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/?month=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className="rounded-lg px-3 py-1.5 text-lg hover:bg-white/10"
          >
            ‹
          </Link>
          <h1 className="text-base font-medium text-white/80">{label}</h1>
          <Link
            href={`/?month=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className="rounded-lg px-3 py-1.5 text-lg hover:bg-white/10"
          >
            ›
          </Link>
        </div>

        <p className="mt-6 text-sm text-white/70">{s.left >= 0 ? "Left to spend" : "Overspent by"}</p>
        <p
          className={`num mt-1 text-5xl font-bold tracking-tight sm:text-7xl ${
            s.left < 0 ? "text-[#ff9d8f]" : ""
          }`}
        >
          {formatMoney(Math.abs(s.left))}
        </p>

        <SalaryBar income={s.income} spent={s.spent} categories={categories} />

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:max-w-xl">
          <div>
            <dt className="text-sm text-white/70">Came in</dt>
            <dd className="num mt-0.5 text-2xl font-semibold">{formatMoney(s.income)}</dd>
            <dd className="mt-1 text-sm text-white/70">
              {s.income === 0
                ? "No salary entered yet"
                : `Salary ${formatMoney(s.salary)}${s.side ? `, side ${formatMoney(s.side)}` : ""}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-white/70">Went out</dt>
            <dd className="num mt-0.5 text-2xl font-semibold">{formatMoney(s.spent)}</dd>
            <dd className="mt-1 text-sm text-white/70">
              Card {formatMoney(s.byMethod.card)}, cash {formatMoney(s.byMethod.cash)}
            </dd>
          </div>
        </dl>
      </section>

      <PasskeySetup hasPasskey={passkeys > 0} />

      <Ledger txs={txs} today={today()} monthName={monthName} aiEnabled={aiConfigured()}>
        <Charts
          monthName={monthName}
          spent={s.spent}
          categories={categories}
          byDay={s.byDay}
          byMethod={s.byMethod}
          months={months}
        />
      </Ledger>

      {user.role !== "admin" && <AdSlot />}
    </div>
  );
}
