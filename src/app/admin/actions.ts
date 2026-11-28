"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { batch, get, run } from "@/lib/db";

export type AdminState = { error?: string; notice?: string };

export async function approveUser(id: number): Promise<void> {
  await requireAdmin();
  await run("UPDATE users SET status = 'approved' WHERE id = ? AND status = 'pending'", [id]);
  revalidatePath("/admin");
}

/** Removes a person and everything they entered. The admin account cannot be removed. */
export async function deleteUser(id: number): Promise<void> {
  const admin = await requireAdmin();
  const target = await get<{ role: string }>("SELECT role FROM users WHERE id = ?", [id]);
  if (!target || target.role === "admin" || id === admin.id) return;
  await batch([
    { sql: "DELETE FROM transactions WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM passkeys WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM events WHERE user_id = ?", args: [id] },
    // AI usage stays for the cost history, without the person attached.
    { sql: "UPDATE ai_usage SET user_id = NULL WHERE user_id = ?", args: [id] },
    { sql: "DELETE FROM users WHERE id = ?", args: [id] },
  ]);
  revalidatePath("/admin");
}

/** Lets an email in: approves it if that person already signed up, otherwise pre-approves it. */
export async function addPerson(_prev: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { error: "Enter a valid email address." };
  }
  const existing = await get<{ status: string }>("SELECT status FROM users WHERE email = ?", [email]);
  if (existing) {
    if (existing.status === "approved") return { notice: `${email} already has access.` };
    await run("UPDATE users SET status = 'approved' WHERE email = ?", [email]);
    revalidatePath("/admin");
    return { notice: `${email} is approved and can log in now.` };
  }
  await run(
    "INSERT INTO allowed_emails (email, added_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING",
    [email, Date.now()],
  );
  revalidatePath("/admin");
  return { notice: `${email} is added. They get in as soon as they create an account.` };
}

export async function removeAllowedEmail(email: string): Promise<void> {
  await requireAdmin();
  await run("DELETE FROM allowed_emails WHERE email = ?", [email]);
  revalidatePath("/admin");
}
