import { formatMoney } from "@/lib/money";

type Cat = { id: string; label: string; color: string; total: number };

/** One bar the width of this month's income, filled by what each category took. */
export function SalaryBar({
  income,
  spent,
  categories,
}: {
  income: number;
  spent: number;
  categories: Cat[];
}) {
  const scale = Math.max(income, spent);
  if (scale === 0) {
    return (
      <p className="mt-6 text-sm text-white/70">
        Add your salary and the bar below it fills as you spend.
      </p>
    );
  }
  const over = spent > income && income > 0;
  return (
    <div className="mt-6">
      <div
        className="relative flex h-5 overflow-hidden rounded-full bg-white/15"
        role="img"
        aria-label={`${formatMoney(spent)} spent of ${formatMoney(income)} income`}
      >
        {categories.map((c) => (
          <div
            key={c.id}
            title={`${c.label}: ${formatMoney(c.total)}`}
            style={{ width: `${(c.total / scale) * 100}%`, background: c.color }}
            className="h-full border-r border-ink last:border-r-0"
          />
        ))}
        {over && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${(income / scale) * 100}%` }}
            title="Your income ends here"
          />
        )}
      </div>
      <p className="mt-2 text-sm text-white/70">
        {income === 0
          ? `${formatMoney(spent)} spent, no income entered`
          : over
            ? "The white line marks where your income ran out"
            : `${Math.round((spent / income) * 100)}% of what came in is spent`}
      </p>
    </div>
  );
}
