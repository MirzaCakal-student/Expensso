import { redirect } from "next/navigation";
import { getUser, userCount } from "@/lib/auth";
import { PasskeyLogin } from "@/components/Passkey";
import { passkeyCount } from "@/lib/passkeys";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const firstRun = (await userCount()) === 0;
  const hasPasskey = !firstRun && (await passkeyCount()) > 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-4xl font-bold tracking-tight">Expensso</h1>
      <p className="mt-2 text-muted">
        {firstRun
          ? "Create your account. It will be the only account on this app."
          : "Log in to see where your money went."}
      </p>
      {hasPasskey && <PasskeyLogin />}
      <LoginForm firstRun={firstRun} />
    </main>
  );
}
