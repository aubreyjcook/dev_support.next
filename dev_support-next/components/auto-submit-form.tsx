"use client";

import {
  useActionState,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import { IDLE_STATE, type FormAction } from "@/lib/action-state";

function PendingArea({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <div
      data-pending={pending ? "" : undefined}
      className={pending ? "is-pending" : undefined}
    >
      {children}
    </div>
  );
}

/**
 * A `<form>` bound to a Server Action that submits itself as soon as a
 * `<select>` changes. Used for the inline "properties" controls on a ticket and
 * for the admin user table, where an explicit Save button would be noise.
 *
 * Progressive enhancement: without JavaScript the form falls back to a normal
 * submit via the `<noscript>` button, so the feature is never unreachable.
 */
export function AutoSubmitForm({
  action,
  children,
  className,
  submitLabel = "Apply",
  hiddenFields,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  hiddenFields?: Record<string, string | number>;
}) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    formRef.current?.requestSubmit();
  }

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "SELECT") submit();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={handleChange}
      className={className}
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={String(value)} />
          ))
        : null}

      <PendingArea>{children}</PendingArea>

      <noscript>
        <button type="submit" className="btn btn-secondary btn-sm mt-1">
          {submitLabel}
        </button>
      </noscript>

      {state.status === "error" ? (
        <p role="status" className="mt-1 text-[11px] text-danger">
          {state.message ?? "Could not save."}
        </p>
      ) : null}
    </form>
  );
}
