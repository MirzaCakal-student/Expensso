// All amounts are stored as integers in feninga (1 KM = 100).

const fmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(cents: number): string {
  return `${fmt.format(cents / 100)} KM`;
}

/** Accepts "12", "12.5", "12,50", "1.234,50", "1,234.50". Returns cents or null. */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;
  let s = input.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep !== -1) {
    const decimals = s.length - lastSep - 1;
    const sepCount = (s.match(/[.,]/g) ?? []).length;
    if (decimals === 3 && sepCount === 1) {
      // "1.234" or "1,234": a thousands separator, not decimals
      s = s.replace(/[.,]/g, "");
    } else {
      s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
    }
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
