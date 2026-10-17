"use client";

import { useActionState } from "react";

import { createTicketAction } from "@/lib/actions/tickets";
import { IDLE_STATE } from "@/lib/action-state";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL } from "@/lib/constants";
import { SubmitButton } from "./submit-button";

const FIELD_ERROR = "mt-1 text-[11px] text-danger";

export function TicketForm() {
  const [state, formAction, pending] = useActionState(createTicketAction, IDLE_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card space-y-5 p-5">
      {state.status === "error" && !state.fieldErrors ? (
        <p
          role="alert"
          className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="subject" className="mb-1 block text-xs font-medium">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          className="input"
          placeholder="Short summary of the problem"
          maxLength={120}
          required
          minLength={3}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? "subject-error" : undefined}
        />
        {errors.subject ? (
          <p id="subject-error" className={FIELD_ERROR}>
            {errors.subject}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-xs font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          className="input min-h-40 resize-y"
          placeholder="What happened, what you tried, how urgent it is, and how to reach you."
          maxLength={8000}
          required
          minLength={10}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
        {errors.description ? (
          <p id="description-error" className={FIELD_ERROR}>
            {errors.description}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-muted">At least 10 characters.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1 block text-xs font-medium">
            Category
          </label>
          <select
            id="category"
            name="category"
            className="input"
            defaultValue="other"
            aria-invalid={Boolean(errors.category)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
          {errors.category ? <p className={FIELD_ERROR}>{errors.category}</p> : null}
        </div>

        <div>
          <label htmlFor="priority" className="mb-1 block text-xs font-medium">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            className="input"
            defaultValue="normal"
            aria-invalid={Boolean(errors.priority)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
          {errors.priority ? <p className={FIELD_ERROR}>{errors.priority}</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
        <SubmitButton pendingLabel="Creating…">Create ticket</SubmitButton>
      </div>

      {pending ? <p className="sr-only">Submitting</p> : null}
    </form>
  );
}
