import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAllowedEmails, listUsers, usage } from "@/lib/admin";
import {
  AICost, AdEstimate, AddPersonForm, DailyChart, RemoveAllowed, Stat, UserActions,
} from "./AdminClient";

export const dynamic = "force-dynamic";

const int = new Intl.NumberFormat("en-US");

function ago(ms: number | null): string {
  if (!ms) return "never";
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [users, allowed, u] = await Promise.all([listUsers(), listAllowedEmails(), usage()]);
  const pending = users.filter((x) => x.status === "pending");
  const approved = users.filter((x) => x.status === "approved");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <span className="font-display text-xl font-bold tracking-tight">Expensso admin</span>
        <Link href="/" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-card">
          Back to my overview
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People with access" value={int.format(approved.length)} />
        <Stat label="Waiting for approval" value={int.format(pending.length)} />
        <Stat label="Active in 7 days" value={int.format(u.activeUsers7)} sub={`${u.activeUsers30} in 30 days`} />
        <Stat label="Entries saved" value={int.format(u.entriesTotal)} sub={`${u.entries30} in 30 days`} />
      </dl>

      <div className="mt-4 flex flex-col gap-4">
        {pending.length > 0 && (
          <Panel title="Waiting for approval">
            <ul>
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
                  <span className="min-w-0 break-all">
                    <span className="block font-medium">{p.email}</span>
                    <span className="text-sm text-muted">Signed up {p.created_at.slice(0, 10)}</span>
                  </span>
                  <UserActions id={p.id} email={p.email} pending removable />
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Give someone access">
          <AddPersonForm />
          {allowed.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm text-muted">Added, not signed up yet</h3>
              <ul>
                {allowed.map((a) => (
                  <li key={a.email} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                    <span className="min-w-0 break-all">{a.email}</span>
                    <RemoveAllowed email={a.email} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="People">
          {approved.length === 0 ? (
            <p className="text-muted">Nobody has access yet.</p>
          ) : (
            <ul>
              {approved.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
                  <span className="min-w-0 break-all">
                    <span className="block font-medium">
                      {p.email}
                      {p.role === "admin" && <span className="ml-2 text-sm font-normal text-muted">(admin)</span>}
                    </span>
                    <span className="text-sm text-muted">
                      {int.format(p.entries)} {p.entries === 1 ? "entry" : "entries"}, last active {ago(p.last_active)}
                    </span>
                  </span>
                  <UserActions id={p.id} email={p.email} pending={false} removable={p.role !== "admin" && p.id !== admin.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Usage, last 30 days">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Screen views" value={int.format(u.views30)} sub={`${u.viewsToday} today`} />
            <Stat label="Logins" value={int.format(u.logins30)} />
            <Stat label="Receipts scanned" value={int.format(u.ai.scans30)} />
            <Stat label="AI chat messages" value={int.format(u.ai.chats30)} />
          </dl>
          <div className="mt-5">
            <DailyChart data={u.daily} />
            <div className="mt-2 flex gap-5 text-sm">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-ink" />Screen views</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#E08A1E]" />AI calls</span>
            </div>
          </div>
        </Panel>

        <Panel title="AI usage, last 30 days">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="AI calls" value={int.format(u.ai.calls30)} sub={`${u.ai.failed30} failed`} />
            <Stat label="Input tokens" value={int.format(u.ai.promptTokens30)} />
            <Stat label="Output tokens" value={int.format(u.ai.completionTokens30)} />
            <Stat
              label="Model used most"
              value={u.ai.models[0]?.model.replace(/^gemini-/, "") ?? "None yet"}
              sub={u.ai.models[0] ? `${u.ai.models[0].calls} calls` : undefined}
            />
          </dl>
          <div className="mt-5">
            <AICost promptTokens={u.ai.promptTokens30} completionTokens={u.ai.completionTokens30} />
          </div>
        </Panel>

        <Panel title="What ads could earn">
          <AdEstimate views30={u.views30} activeUsers30={u.activeUsers30} />
          <p className="mt-4 text-sm text-muted">
            {process.env.NEXT_PUBLIC_ADSENSE_CLIENT
              ? "Ads are switched on and shown to everyone except you."
              : "Ads are off. They turn on once a Google AdSense account is connected."}
          </p>
        </Panel>
      </div>
    </div>
  );
}
