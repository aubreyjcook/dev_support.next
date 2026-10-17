"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that reflects the pending state of its enclosing `<form>`.
 * Must be rendered inside that form (that is how `useFormStatus` works).
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className = "btn btn-primary",
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingLabel : children}
    </button>
  );
}
