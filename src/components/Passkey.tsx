"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";

/** True when this device can use a built-in fingerprint or face sensor. */
function usePlatformAuthenticator(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setOk)
      .catch(() => setOk(false));
  }, []);
  return ok;
}

const noSubscribe = () => () => {};

function cancelled(err: unknown): boolean {
  return err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError");
}

export function PasskeyLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // false while rendering on the server, the real answer in the browser
  const supported = useSyncExternalStore(noSubscribe, browserSupportsWebAuthn, () => false);
  if (!supported) return null;

  async function login() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/passkey/login");
      const optionsJSON = await res.json();
      if (!res.ok) throw new Error(optionsJSON.error);
      const answer = await startAuthentication({ optionsJSON });
      const check = await fetch("/api/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answer),
      });
      const data = await check.json();
      if (!check.ok) throw new Error(data.error);
      router.replace("/");
      router.refresh();
    } catch (err) {
      if (!cancelled(err)) {
        setError(err instanceof Error && err.message ? err.message : "Fingerprint login failed.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <button className="btn btn-primary w-full" onClick={login} disabled={busy}>
        {busy ? "Waiting for your fingerprint…" : "Log in with fingerprint"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-alert">
          {error}
        </p>
      )}
      <p className="mt-6 text-center text-sm text-muted">or use your password</p>
    </div>
  );
}

export function PasskeySetup({ hasPasskey }: { hasPasskey: boolean }) {
  const supported = usePlatformAuthenticator();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  if (!supported || hasPasskey) return null;

  async function enable() {
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/passkey/register");
      const optionsJSON = await res.json();
      if (!res.ok) throw new Error(optionsJSON.error);
      const answer = await startRegistration({ optionsJSON });
      const check = await fetch("/api/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answer),
      });
      const data = await check.json();
      if (!check.ok) throw new Error(data.error);
      setState("done");
    } catch (err) {
      if (!cancelled(err)) {
        setError(err instanceof Error && err.message ? err.message : "Could not turn on fingerprint login.");
      }
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="mt-4 rounded-2xl bg-card px-5 py-4 text-sm">
        Fingerprint login is on. Next time, tap Log in with fingerprint.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-card px-5 py-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-sm">Skip the password next time and log in with your fingerprint.</p>
      <button className="btn" onClick={enable} disabled={state === "busy"}>
        {state === "busy" ? "Waiting for your fingerprint…" : "Turn on fingerprint login"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
