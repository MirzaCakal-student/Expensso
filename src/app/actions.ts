"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearFails, createSession, destroySession, hashPassword, isLocked,
  recordFail, requireUser, userCount, verifyPassword,
} from "@/lib/auth";
import { get, run } from "@/lib/db";
import { isExpenseCategory, isIncomeSource, isPaymentMethod } from "@/lib/categories";
import { parseAmount } from "@/lib/money";
import { isValidDate } from "@/lib/summary";

export type FormState = { error?: string };

export async function authenticate(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  // OWNER_EMAIL locks the app to one address, so nobody else can claim it
  // by registering first once it is online.
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner && process.env.VERCEL) {
    return { error: "OWNER_EMAIL is not set on the server. Add it in the Vercel project settings." };
  }
  if (owner && email !== owner) {
    await recordFail(email);
    return { error: "Wrong email or password." };
  }

  if ((await userCount()) === 0) {
    // First run: the first account created becomes the only account.
    if (password.length < 8) return { error: "Use a password with at least 8 characters." };
    const res = await run("INSERT INTO users (email, password_hash) VALUES (?, ?)", [
      email,
      hashPassword(password),
    ]);
    await createSession(res.lastId);
    redirect("/");
  }

  if (await isLocked(email)) {
    return { error: "Too many wrong attempts. Try again in 15 minutes." };
  }
  const user = await get<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    await recordFail(email);
    return { error: "Wrong email or password." };
  }
  await clearFails(email);
  await createSession(user.id);
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
  }
  revalidatePath("/");
  return {};
}

export async function deleteTransaction(id: number): Promise<void> {
  const user = await requireUser();
  await run("DELETE FROM transactions WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/");
}
