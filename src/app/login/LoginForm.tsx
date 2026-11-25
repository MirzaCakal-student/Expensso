"use client";

import { useActionState } from "react";
import { authenticate, type FormState } from "../actions";

export function LoginForm({ firstRun }: { firstRun: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(authenticate, {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
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
          autoComplete={firstRun ? "new-password" : "current-password"}
          minLength={firstRun ? 8 : undefined}
          required
        />
        {firstRun && <span className="font-normal text-muted">At least 8 characters.</span>}
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary mt-2" disabled={pending}>
        {firstRun ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
