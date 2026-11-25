"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

type Cat = { id: string; label: string; color: string; total: number };

const INK = "#10262b";
const GAIN = "#1e7a52";
const CASH = "#8fa3a6";

const km = (v: unknown) => formatMoney(Number(v));
const axisKm = (v: number) => `${Math.round(v / 100)}`;
const tick = { fontSize: 12, fill: "#5b6b6e" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Charts({
  monthName, spent, categories, byDay, byMethod, months,
}: {
  monthName: string;
  spent: number;
  categories: Cat[];
  byDay: { day: number; total: number }[];
  byMethod: { cash: number; card: number };
  months: { label: string; income: number; spent: number }[];
}) {
  const hasHistory = months.some((m) => m.income > 0 || m.spent > 0);
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Where it went">
        {spent === 0 ? (
          <p className="text-muted">
            Nothing spent in {monthName} yet. Add an expense and the breakdown fills in.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={categories.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {categories.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={km} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted">Spent</span>
                <span className="num text-base font-semibold">{formatMoney(spent)}</span>
              </div>
            </div>
            <ul className="w-full min-w-0 flex-1">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1">{c.label}</span>
                  <span className="num text-sm text-muted">{Math.round((c.total / spent) * 100)}%</span>
                  <span className="num whitespace-nowrap text-right font-semibold">{formatMoney(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {spent > 0 && (
        <Panel title="Card or cash">
          <div className="flex h-4 overflow-hidden rounded-full bg-line">
            <div style={{ width: `${(byMethod.card / spent) * 100}%`, background: INK }} />
            <div style={{ width: `${(byMethod.cash / spent) * 100}%`, background: CASH }} />
          </div>
          <div className="mt-3 flex justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: INK }} />
              Card <span className="num font-semibold">{formatMoney(byMethod.card)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: CASH }} />
              Cash <span className="num font-semibold">{formatMoney(byMethod.cash)}</span>
            </span>
          </div>
        </Panel>
      )}

      {spent > 0 && (
        <Panel title={`Day by day in ${monthName}`}>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e4e8e6" />
                <XAxis dataKey="day" tick={tick} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={axisKm} />
                <Tooltip formatter={km} labelFormatter={(d) => `${monthName} ${d}`} cursor={{ fill: "#edf0ee" }} />
                <Bar dataKey="total" name="Spent" fill={INK} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {hasHistory && (
        <Panel title="Last 6 months">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="#e4e8e6" />
                <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={axisKm} />
                <Tooltip formatter={km} cursor={{ fill: "#edf0ee" }} />
                <Bar dataKey="income" name="Came in" fill={GAIN} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="spent" name="Went out" fill={INK} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: GAIN }} />
              Came in
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: INK }} />
              Went out
            </span>
          </div>
        </Panel>
      )}
    </div>
  );
}
