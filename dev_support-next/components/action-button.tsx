"use client";

import { useActionState } from "react";

import { IDLE_STATE, type FormAction } from "@/lib/action-state";

/**
 * Small form-backed button for one-shot actions (close ticket, toggle a user's
 * active state). Reports its own pending and error state.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  className = "btn btn-secondary btn-sm",
}: {
  action: FormAction;
  fields: Record<string, string | number>;
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <button type="submit" className={className} disabled={pending}>
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {state.status === "error" ? (
        <span role="status" className="text-[11px] text-danger">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
