"use client";

import { useActionState, useEffect, useRef } from "react";

import { IDLE_STATE } from "@/lib/action-state";
import { addMessageAction } from "@/lib/actions/tickets";

/**
 * Reply composer, shared by requesters and staff.
 *
 * Staff additionally get an "internal note" checkbox that is named
 * `visibility` and only submitted when ticked, so the form needs no React
 * state: the dashed styling comes from `:has(:checked)` in globals.css.
 */
export function ReplyForm({ ticketId, isStaff }: { ticketId: number; isStaff: boolean }) {
  const [state, formAction, pending] = useActionState(addMessageAction, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // A new successful submission clears the textarea. This is a DOM write, not
    // React state, so it is the documented "synchronize with an external
    // system" use of an effect.
    if (state.status === "success") formRef.current?.reset();
  }, [state.stamp, state.status]);

  const error = state.fieldErrors?.body;

  return (
    <form ref={formRef} action={formAction} className="reply-composer card p-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      <label htmlFor="reply-body" className="sr-only">
        Reply
      </label>
      <textarea
        id="reply-body"
        name="body"
        rows={4}
        required
        minLength={2}
        maxLength={8000}
        className="input resize-y"
        placeholder="Write a reply…"
        aria-invalid={Boolean(error)}
      />

      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isStaff ? (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
              <input
                type="checkbox"
                name="visibility"
                value="internal"
                className="size-3.5 accent-[var(--accent)]"
              />
              Internal note
            </label>
          ) : (
            <span className="text-[11px] text-muted">Replies notify the support team.</span>
          )}

          {state.status === "success" ? (
            <span role="status" className="badge badge-emerald">
              {state.message}
            </span>
          ) : null}
          {state.status === "error" && !error ? (
            <span role="alert" className="text-[11px] text-danger">
              {state.message}
            </span>
          ) : null}
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
