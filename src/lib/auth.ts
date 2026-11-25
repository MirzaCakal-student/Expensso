import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "./db";

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

export async function userCount(): Promise<number> {
  return (await get<{ n: number }>("SELECT COUNT(*) AS n FROM users"))?.n ?? 0;
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  await run("DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
  await run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    sha(token),
    userId,
    expires,
  ]);
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
  if (token) await run("DELETE FROM sessions WHERE token_hash = ?", [sha(token)]);
  jar.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await get<User>(
    `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha(token), Date.now()],
  );
  return row ? { id: row.id, email: row.email } : null;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Basic brute-force protection: 5 wrong passwords locks that email for 15 minutes.
// Kept in the database so it holds across serverless instances.
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;

export async function isLocked(email: string): Promise<boolean> {
  const f = await get<{ count: number; until: number }>(
    "SELECT count, until FROM login_failures WHERE email = ?",
    [email],
  );
  return Boolean(f && f.until > Date.now() && f.count >= MAX_FAILS);
}

export async function recordFail(email: string): Promise<void> {
  const now = Date.now();
  await run(
    `INSERT INTO login_failures (email, count, until) VALUES (?, 1, ?)
     ON CONFLICT(email) DO UPDATE SET
       count = CASE WHEN until > ? THEN count + 1 ELSE 1 END,
       until = excluded.until`,
    [email, now + WINDOW_MS, now],
  );
}

export async function clearFails(email: string): Promise<void> {
  await run("DELETE FROM login_failures WHERE email = ?", [email]);
}
