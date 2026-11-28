"use client";

import { useActionState, useState } from "react";
import { authenticate, type FormState } from "../actions";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState<FormState, FormData>(authenticate, {});
  const signup = mode === "signup";

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="intent" value={mode} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Email
        <input className="field" type="email" name="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Password
        <input
          className="field"
          type="password"
          name="password"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          required
        />
        {signup && <span className="font-normal text-muted">At least 8 characters.</span>}
      </label>
      {signup && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">I am the admin</summary>
          <label className="mt-2 flex flex-col gap-1.5 font-medium">
            Admin setup code
            <input className="field" name="setupCode" autoComplete="off" />
          </label>
        </details>
      )}
      {state.error && (
        <p role="alert" className="text-sm font-medium text-alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="rounded-xl bg-card px-3 py-2 text-sm">
          {state.notice}
        </p>
      )}
      <button className="btn btn-primary mt-2" disabled={pending}>
        {signup ? "Create account" : "Log in"}
      </button>
      <button
        type="button"
        onClick={() => setMode(signup ? "login" : "signup")}
        className="cursor-pointer text-sm font-medium text-muted hover:text-ink"
      >
        {signup ? "I already have an account" : "New here? Create an account"}
      </button>
    </form>
  );
}
