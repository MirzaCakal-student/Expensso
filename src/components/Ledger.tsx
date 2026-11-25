"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteTransaction, saveTransaction } from "@/app/actions";
import {
  EXPENSE_CATEGORIES, INCOME_SOURCES, PAYMENT_METHODS, categoryColor, categoryLabel,
} from "@/lib/categories";
import { fileToDataUrl } from "@/lib/image-client";
import { centsToInput, formatMoney } from "@/lib/money";
import type { Tx } from "@/lib/summary";

type Draft = {
  id?: number;
  kind: "income" | "expense";
  amount: string;
  date: string;
  category: string;
  method: string;
  note: string;
  scanned?: boolean;
};

function dayLabel(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function Ledger({
  txs, today, monthName, aiEnabled, children,
}: {
  txs: Tx[];
  today: string;
  monthName: string;
  aiEnabled: boolean;
  children: React.ReactNode;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (draft && !d.open) {
      d.showModal();
      // showModal focuses the first control (Close); put the cursor in the amount instead.
      if (!draft.scanned) amountRef.current?.focus();
    }
    if (!draft && d.open) d.close();
  }, [draft]);

  const open = (d: Draft) => {
    setError("");
    setDraft(d);
  };
  const newExpense = () =>
    open({ kind: "expense", amount: "", date: today, category: "food_shopping", method: "card", note: "" });
  const newIncome = () =>
    open({ kind: "income", amount: "", date: today, category: "salary", method: "", note: "" });
  const edit = (t: Tx) =>
    open({
      id: t.id, kind: t.kind, amount: centsToInput(t.amount), date: t.date,
      category: t.category, method: t.method ?? "", note: t.note,
    });

  async function onScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanError("");
    setScanning(true);
    try {
      const image = await fileToDataUrl(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read the receipt.");
      open({
        kind: "expense",
        amount: data.amount ? centsToInput(data.amount) : "",
        date: data.date ?? today,
        category: data.category,
        method: data.method ?? "card",
        note: data.merchant ?? "",
        scanned: true,
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Could not read the receipt.");
    } finally {
      setScanning(false);
    }
  }

  function submit(form: FormData) {
    startTransition(async () => {
      const res = await saveTransaction(form);
      if (res.error) setError(res.error);
      else setDraft(null);
    });
  }

  function remove(id: number) {
    if (!window.confirm("Delete this entry?")) return;
    startTransition(async () => {
      await deleteTransaction(id);
      setDraft(null);
    });
  }

  const groups = new Map<string, Tx[]>();
  for (const t of txs) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:flex">
        <button className="btn btn-primary col-span-2 sm:px-6" onClick={newExpense}>
          Add expense
        </button>
        <button
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={!aiEnabled || scanning}
          title={aiEnabled ? undefined : "Add AI_API_KEY to .env.local to turn on receipt scanning"}
        >
          {scanning ? "Reading receipt…" : "Scan receipt"}
        </button>
        <button className="btn" onClick={newIncome}>
          Add income
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onScan}
        />
      </div>
      {!aiEnabled && (
        <p className="mt-2 text-sm text-muted">
          Receipt scanning is off until an AI key is added to .env.local.
        </p>
      )}
      {scanError && (
        <p role="alert" className="mt-2 text-sm font-medium text-alert">
          {scanError}
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {children}

        <section className="rounded-2xl bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Entries</h2>
          {txs.length === 0 ? (
            <p className="mt-4 text-muted">
              No entries for {monthName} yet. Add your salary to start the month.
            </p>
          ) : (
            [...groups.entries()].map(([date, items]) => (
              <div key={date} className="mt-4">
                <h3 className="text-sm text-muted">{dayLabel(date)}</h3>
                <ul>
                  {items.map((t) => (
                    <li key={t.id} className="border-b border-line last:border-b-0">
                      <button
                        onClick={() => edit(t)}
                        className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left hover:bg-paper/60"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: t.kind === "income" ? "#1e7a52" : categoryColor(t.category) }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{categoryLabel(t.category)}</span>
                          <span className="block truncate text-sm text-muted">
                            {[t.kind === "expense" ? (t.method === "cash" ? "Cash" : "Card") : null, t.note]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                        <span className={`num font-semibold ${t.kind === "income" ? "text-gain" : ""}`}>
                          {t.kind === "income" ? "+" : "−"}
                          {formatMoney(t.amount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setDraft(null)}
        className="m-auto w-[min(100%-1.5rem,28rem)] rounded-3xl bg-paper p-0 text-ink"
      >
        {draft && (
          <form action={submit} key={draft.id ?? "new"} className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">
                {draft.id ? "Edit" : "Add"} {draft.kind}
              </h2>
              <button
                type="button"
                onClick={() => setDraft(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg px-2 py-1 text-xl text-muted hover:bg-card"
              >
                ×
              </button>
            </div>
            {draft.scanned && (
              <p className="rounded-xl bg-card px-3 py-2 text-sm text-muted">
                Filled in from your receipt. Check the amount before saving.
              </p>
            )}
            <input type="hidden" name="kind" value={draft.kind} />
            {draft.id && <input type="hidden" name="id" value={draft.id} />}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Amount (KM)
              <input
                className="field num text-2xl font-semibold"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={draft.amount}
                ref={amountRef}
                required
              />
            </label>

            {draft.kind === "expense" ? (
              <>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Category</legend>
                  <div className="flex flex-wrap gap-2">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <label key={c.id} className="cursor-pointer">
                        <input
                          type="radio"
                          name="category"
                          value={c.id}
                          defaultChecked={draft.category === c.id}
                          className="peer sr-only"
                        />
                        <span className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                          {c.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Segmented legend="Paid with" name="method" options={PAYMENT_METHODS} value={draft.method} />
              </>
            ) : (
              <Segmented legend="Source" name="category" options={INCOME_SOURCES} value={draft.category} />
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Date
              <input className="field" type="date" name="date" defaultValue={draft.date} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Note (optional)
              <input className="field" name="note" maxLength={200} defaultValue={draft.note} />
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              {draft.id && (
                <button
                  type="button"
                  className="btn text-alert"
                  disabled={pending}
                  onClick={() => remove(draft.id!)}
                >
                  Delete
                </button>
              )}
              <button className="btn btn-primary flex-1" disabled={pending}>
                Save {draft.kind}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

function Segmented({
  legend, name, options, value,
}: {
  legend: string;
  name: string;
  options: readonly { id: string; label: string }[];
  value: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <label key={o.id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.id}
              defaultChecked={value === o.id}
              className="peer sr-only"
            />
            <span className="block rounded-xl border border-line bg-card py-2 text-center font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
