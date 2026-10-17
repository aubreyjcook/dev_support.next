"use client";

import { useActionState } from "react";

import { IDLE_STATE } from "@/lib/action-state";
import { signIn } from "@/lib/actions/session";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, IDLE_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="input"
          placeholder="you@organization.com"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
