import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { PasskeyLogin } from "@/components/Passkey";
import { passkeyCount } from "@/lib/passkeys";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const hasPasskey = (await passkeyCount()) > 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-4xl font-bold tracking-tight">Expensso</h1>
      <p className="mt-2 text-muted">Track what comes in and see where it goes.</p>
      {hasPasskey && <PasskeyLogin />}
      <LoginForm />
    </main>
  );
}
