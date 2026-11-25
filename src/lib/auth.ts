import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "session";
const SESSION_DAYS = 30;

export type User = { id: number; email: string };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function userCount(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(sha(token), userId, expires);
  const h = await headers();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Over plain http on the home network a Secure cookie would never be sent back.
    secure: h.get("x-forwarded-proto") === "https",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  jar.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha(token), Date.now()) as User | undefined;
  return row ? { id: row.id, email: row.email } : null;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Basic brute-force protection: 5 wrong passwords locks that email for 15 minutes.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;
const g = globalThis as unknown as { __loginFails?: Map<string, { n: number; until: number }> };
const fails = (g.__loginFails ??= new Map());

export function isLocked(email: string): boolean {
  const f = fails.get(email);
  if (!f) return false;
  if (Date.now() > f.until) {
    fails.delete(email);
    return false;
  }
  return f.n >= MAX_FAILS;
}
export function recordFail(email: string): void {
  const f = fails.get(email);
  const n = f && Date.now() <= f.until ? f.n + 1 : 1;
  fails.set(email, { n, until: Date.now() + WINDOW_MS });
}
export function clearFails(email: string): void {
  fails.delete(email);
}
