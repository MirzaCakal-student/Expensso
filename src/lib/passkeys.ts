import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { all, get, run } from "./db";

// Passkeys let the phone's fingerprint or face unlock replace the password.
// The phone keeps the private key; the server only stores the public key.

const CHALLENGE_COOKIE = "webauthn";
const CHALLENGE_MS = 5 * 60_000;

type StoredPasskey = {
  id: string;
  user_id: number;
  public_key: string;
  counter: number;
  transports: string;
};

/** The site's own origin and host, as the browser will report them. */
async function relyingParty(): Promise<{ origin: string; rpID: string }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  return { origin: `${proto}://${host}`, rpID: host.replace(/:\d+$/, "") };
}

async function saveChallenge(challenge: string, userId: number | null): Promise<void> {
  const id = randomBytes(24).toString("base64url");
  await run("DELETE FROM webauthn_challenges WHERE expires_at < ?", [Date.now()]);
  await run(
    "INSERT INTO webauthn_challenges (id, challenge, user_id, expires_at) VALUES (?, ?, ?, ?)",
    [id, challenge, userId, Date.now() + CHALLENGE_MS],
  );
  (await cookies()).set(CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: (await relyingParty()).origin.startsWith("https"),
    path: "/",
    maxAge: CHALLENGE_MS / 1000,
  });
}

/** Returns the pending challenge once, then forgets it. */
async function takeChallenge(): Promise<{ challenge: string; user_id: number | null } | null> {
  const jar = await cookies();
  const id = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!id) return null;
  const row = await get<{ challenge: string; user_id: number | null; expires_at: number }>(
    "SELECT challenge, user_id, expires_at FROM webauthn_challenges WHERE id = ?",
    [id],
  );
  await run("DELETE FROM webauthn_challenges WHERE id = ?", [id]);
  if (!row || row.expires_at < Date.now()) return null;
  return { challenge: row.challenge, user_id: row.user_id };
}

const splitTransports = (t: string) => (t ? t.split(",") : undefined);

export async function passkeyCount(userId?: number): Promise<number> {
  const row = userId
    ? await get<{ n: number }>("SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?", [userId])
    : await get<{ n: number }>("SELECT COUNT(*) AS n FROM passkeys");
  return row?.n ?? 0;
}

export async function registrationOptions(user: { id: number; email: string }) {
  const { rpID } = await relyingParty();
  const existing = await all<StoredPasskey>("SELECT id, transports FROM passkeys WHERE user_id = ?", [
    user.id,
  ]);
  const options = await generateRegistrationOptions({
    rpName: "Expensso",
    rpID,
    userName: user.email,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: splitTransports(p.transports) })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    preferredAuthenticatorType: "localDevice",
  });
  await saveChallenge(options.challenge, user.id);
  return options;
}

export async function finishRegistration(
  userId: number,
  response: RegistrationResponseJSON,
): Promise<boolean> {
  const pending = await takeChallenge();
  if (!pending || pending.user_id !== userId) return false;
  const { origin, rpID } = await relyingParty();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!result.verified) return false;
  const c = result.registrationInfo.credential;
  await run(
    "INSERT OR REPLACE INTO passkeys (id, user_id, public_key, counter, transports) VALUES (?, ?, ?, ?, ?)",
    [c.id, userId, Buffer.from(c.publicKey).toString("base64url"), c.counter, (c.transports ?? []).join(",")],
  );
  return true;
}

export async function authenticationOptions() {
  const { rpID } = await relyingParty();
  const keys = await all<StoredPasskey>("SELECT id, transports FROM passkeys");
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: keys.map((p) => ({ id: p.id, transports: splitTransports(p.transports) })),
    userVerification: "required",
  });
  await saveChallenge(options.challenge, null);
  return options;
}

/** Verifies a fingerprint login and returns the user id it belongs to. */
export async function finishAuthentication(
  response: AuthenticationResponseJSON,
): Promise<number | null> {
  const pending = await takeChallenge();
  if (!pending || typeof response?.id !== "string") return null;
  const key = await get<StoredPasskey>(
    "SELECT id, user_id, public_key, counter, transports FROM passkeys WHERE id = ?",
    [response.id],
  );
  if (!key) return null;
  const { origin, rpID } = await relyingParty();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: key.id,
      publicKey: new Uint8Array(Buffer.from(key.public_key, "base64url")),
      counter: key.counter,
      transports: splitTransports(key.transports),
    },
  });
  if (!result.verified) return null;
  await run("UPDATE passkeys SET counter = ? WHERE id = ?", [
    result.authenticationInfo.newCounter,
    key.id,
  ]);
  return key.user_id;
}
