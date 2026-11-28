"use client";

import { useActionState, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addPerson, approveUser, deleteUser, removeAllowedEmail, type AdminState } from "./actions";

export function AddPersonForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addPerson, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Email
          <input className="field" type="email" name="email" required placeholder="name@example.com" />
        </label>
        <button className="btn btn-primary" disabled={pending}>
          Give access
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}

function Message({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-alert">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="text-sm">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function UserActions({
  id,
  email,
  pending: isPending,
  removable,
}: {
  id: number;
  email: string;
  pending: boolean;
  removable: boolean;
}) {
  const [busy, start] = useTransition();
  return (
    <div className="flex gap-2">
      {isPending && (
        <button className="btn btn-primary px-3 py-1.5 text-sm" disabled={busy} onClick={() => start(() => approveUser(id))}>
          Approve
        </button>
      )}
      {removable && (
        <button
          className="btn px-3 py-1.5 text-sm text-alert"
          disabled={busy}
          onClick={() => {
            const what = isPending ? `Reject ${email}?` : `Delete ${email} and everything they entered?`;
            if (window.confirm(`${what} This cannot be undone.`)) start(() => deleteUser(id));
          }}
        >
          {isPending ? "Reject" : "Delete"}
        </button>
      )}
    </div>
  );
}

export function RemoveAllowed({ email }: { email: string }) {
  const [busy, start] = useTransition();
  return (
    <button
      className="cursor-pointer text-sm font-medium text-muted hover:text-alert"
      disabled={busy}
      onClick={() => start(() => removeAllowedEmail(email))}
    >
      Remove
    </button>
  );
}

export function DailyChart({ data }: { data: { day: string; views: number; ai: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.day.slice(8) }));
  const tick = { fontSize: 12, fill: "#5b6b6e" };
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 0, left: -24, bottom: 0 }} barGap={1}>
          <CartesianGrid vertical={false} stroke="#e4e8e6" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={4} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.day ?? ""} cursor={{ fill: "#edf0ee" }} />
          <Bar dataKey="views" name="Screen views" fill="#10262b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="ai" name="AI calls" fill="#E08A1E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-US");

function NumberInput({
  label, value, onChange, step = "0.01", hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        className="field num"
        type="number"
        min="0"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}

/** What ads could earn: screen views × what the ad network pays per 1,000 views. */
export function AdEstimate({ views30, activeUsers30 }: { views30: number; activeUsers30: number }) {
  const [rpm, setRpm] = useState(1);
  const [users, setUsers] = useState(1000);
  const perUser = activeUsers30 > 0 ? views30 / activeUsers30 : 0;
  const now = (views30 / 1000) * rpm;
  const scenario = ((perUser * users) / 1000) * rpm;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          label="Earnings per 1,000 views (USD)"
          value={rpm}
          onChange={setRpm}
          hint="A guess until real ad numbers come in. Change it to what your ad network reports."
        />
        <NumberInput label="If the app had this many active users" value={users} onChange={setUsers} step="100" />
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Stat label="With today's usage, per month" value={usd.format(now)} sub={`${int.format(views30)} views in 30 days`} />
        <Stat
          label={`With ${int.format(users)} active users, per month`}
          value={usd.format(scenario)}
          sub={perUser ? `${perUser.toFixed(1)} views per user now` : "No views yet to base this on"}
        />
      </dl>
    </div>
  );
}

/** What AI would cost on a paid plan. The free tier costs nothing until its limits. */
export function AICost({ promptTokens, completionTokens }: { promptTokens: number; completionTokens: number }) {
  const [inPrice, setIn] = useState(0);
  const [outPrice, setOut] = useState(0);
  const cost = (promptTokens / 1e6) * inPrice + (completionTokens / 1e6) * outPrice;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput label="Price per 1M input tokens (USD)" value={inPrice} onChange={setIn} step="0.01" />
        <NumberInput label="Price per 1M output tokens (USD)" value={outPrice} onChange={setOut} step="0.01" />
      </div>
      <p className="text-sm text-muted">
        On the free Gemini plan both prices are 0. If you move to a paid plan, enter the prices from
        Google&apos;s pricing page for the model you use.
      </p>
      <Stat label="AI cost for the last 30 days" value={usd.format(cost)} sub={`${int.format(promptTokens + completionTokens)} tokens`} />
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num mt-1 text-2xl font-semibold">{value}</dd>
      {sub && <dd className="mt-1 text-sm text-muted">{sub}</dd>}
    </div>
  );
}
