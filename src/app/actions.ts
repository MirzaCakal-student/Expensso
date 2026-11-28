"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminEmail, clearFails, createSession, destroySession, hashPassword, isLocked,
  recordFail, requireUser, verifyPassword,
} from "@/lib/auth";
import { get, run } from "@/lib/db";
import { isExpenseCategory, isIncomeSource, isPaymentMethod } from "@/lib/categories";
import { parseAmount } from "@/lib/money";
import { isValidDate } from "@/lib/summary";
import { track } from "@/lib/track";

export type FormState = { error?: string; notice?: string };

const MAX_PENDING = 200;

function setupCodeMatches(code: string): boolean {
  const expected = process.env.ADMIN_SETUP_CODE;
  if (!expected) return !process.env.VERCEL; // locally a code is optional
  const a = createHash("sha256").update(code).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function authenticate(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const intent = form.get("intent") === "signup" ? "signup" : "login";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { error: "Enter a valid email address." };
  }
  if (await isLocked(email)) {
    return { error: "Too many wrong attempts. Try again in 15 minutes." };
  }

  if (intent === "signup") {
    if (password.length < 8) return { error: "Use a password with at least 8 characters." };
    if (await get("SELECT 1 FROM users WHERE email = ?", [email])) {
      return { error: "An account with this email already exists. Log in instead." };
    }
    // The admin's email and emails the admin added are let in straight away;
    // everyone else waits for approval.
    const isAdmin = email === adminEmail();
    // Emails are not verified, so the admin account also needs a secret setup
    // code; otherwise anyone who knows the admin's email could claim it first.
    if (isAdmin && !setupCodeMatches(String(form.get("setupCode") ?? ""))) {
      return { error: "The admin account needs the correct setup code." };
    }
    const invited = Boolean(await get("SELECT 1 FROM allowed_emails WHERE email = ?", [email]));
    const approved = isAdmin || invited;
    if (!approved) {
      const pending = await get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM users WHERE status = 'pending'",
      );
      if ((pending?.n ?? 0) >= MAX_PENDING) {
        return { error: "Sign-ups are paused right now. Try again later." };
      }
    }
    const res = await run(
      "INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, ?)",
      [email, hashPassword(password), isAdmin ? "admin" : "user", approved ? "approved" : "pending"],
    );
    if (invited) await run("DELETE FROM allowed_emails WHERE email = ?", [email]);
    await track(res.lastId, "signup");
    if (!approved) {
      return { notice: "Account created. You can log in as soon as the admin approves it." };
    }
    await createSession(res.lastId);
    redirect("/");
  }

  const user = await get<{ id: number; password_hash: string; status: string }>(
    "SELECT id, password_hash, status FROM users WHERE email = ?",
    [email],
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    await recordFail(email);
    return { error: "Wrong email or password." };
  }
  await clearFails(email);
  if (user.status !== "approved") {
    return { notice: "Your account is waiting for the admin's approval." };
  }
  await createSession(user.id);
  await track(user.id, "login");
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function saveTransaction(form: FormData): Promise<FormState> {
  const user = await requireUser();
  const kind = form.get("kind");
  if (kind !== "income" && kind !== "expense") return { error: "Unknown entry type." };

  const amount = parseAmount(String(form.get("amount") ?? ""));
  if (amount === null) return { error: "Enter an amount greater than zero." };
  if (amount > 100_000_000_00) return { error: "That amount is too large." };

  const date = form.get("date");
  if (!isValidDate(date)) return { error: "Pick a valid date." };

  const category = form.get("category");
  let method: string | null = null;
  if (kind === "expense") {
    if (!isExpenseCategory(category)) return { error: "Pick a category." };
    const m = form.get("method");
    if (!isPaymentMethod(m)) return { error: "Pick cash or card." };
    method = m;
  } else if (!isIncomeSource(category)) {
    return { error: "Pick salary or side income." };
  }
  const note = String(form.get("note") ?? "").trim().slice(0, 200);

  const id = Number(form.get("id"));
  if (id) {
    await run(
      `UPDATE transactions SET kind=?, amount=?, date=?, category=?, method=?, note=?
       WHERE id=? AND user_id=?`,
      [kind, amount, date, category as string, method, note, id, user.id],
    );
  } else {
    await run(
      `INSERT INTO transactions (user_id, kind, amount, date, category, method, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.id, kind, amount, date, category as string, method, note],
    );
    await track(user.id, "entry");
  }
  revalidatePath("/");
  return {};
}

export async function deleteTransaction(id: number): Promise<void> {
  const user = await requireUser();
  await run("DELETE FROM transactions WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/");
}
