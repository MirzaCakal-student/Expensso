import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { track } from "@/lib/track";
import { authenticationOptions, finishAuthentication, passkeyCount } from "@/lib/passkeys";

// GET: a fingerprint login challenge. POST: check the signed answer and log in.

export async function GET() {
  if ((await passkeyCount()) === 0) {
    return NextResponse.json({ error: "Fingerprint login is not set up yet." }, { status: 404 });
  }
  return NextResponse.json(await authenticationOptions());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  let userId: number | null = null;
  try {
    userId = await finishAuthentication(body);
  } catch (err) {
    console.error("Passkey login failed", err);
  }
  if (!userId) {
    return NextResponse.json(
      { error: "Your fingerprint was not recognised. Try again or use your password." },
      { status: 401 },
    );
  }
  await createSession(userId);
  await track(userId, "login");
  return NextResponse.json({ ok: true });
}
