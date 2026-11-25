import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { finishRegistration, registrationOptions } from "@/lib/passkeys";

// GET: options for adding this phone's fingerprint. POST: save it.

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Log in again." }, { status: 401 });
  return NextResponse.json(await registrationOptions(user));
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Log in again." }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (await finishRegistration(user.id, body)) return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Passkey registration failed", err);
  }
  return NextResponse.json(
    { error: "Fingerprint login could not be turned on. Try again." },
    { status: 400 },
  );
}
