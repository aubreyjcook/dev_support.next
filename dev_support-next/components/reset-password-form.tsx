"use client";

import { useActionState } from "react";

import { IDLE_STATE } from "@/lib/action-state";
import { resetPasswordAction } from "@/lib/actions/users";

/** Inline password reset for an existing user. */
export function ResetPasswordForm({ userId, name }: { userId: number; name: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, IDLE_STATE);

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor={`password-${userId}`} className="sr-only">
        New password for {name}
      </label>
      <input
        id={`password-${userId}`}
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="New password (8+ chars)"
        className="input input-sm w-48"
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={pending}>
        {pending ? "Saving…" : "Set password"}
      </button>
      {state.status === "error" ? (
        <span role="status" className="text-[11px] text-danger">
          {state.message}
        </span>
      ) : null}
      {state.status === "success" ? (
        <span role="status" className="text-[11px] text-muted">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
