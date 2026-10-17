"use client";

import { useActionState } from "react";

import { IDLE_STATE } from "@/lib/action-state";
import { createUserAction } from "@/lib/actions/users";
import { ROLE_DESCRIPTION, ROLES, ROLE_LABEL } from "@/lib/constants";
import { SubmitButton } from "./submit-button";

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, IDLE_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="new-name" className="mb-1 block text-xs font-medium">
            Full name
          </label>
          <input
            id="new-name"
            name="name"
            className="input"
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
          />
          {errors.name ? <p className="mt-1 text-[11px] text-danger">{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="new-email" className="mb-1 block text-xs font-medium">
            Email
          </label>
          <input
            id="new-email"
            name="email"
            type="email"
            className="input"
            required
            autoComplete="off"
            placeholder="name@organization.com"
          />
          {errors.email ? (
            <p className="mt-1 text-[11px] text-danger">{errors.email}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="new-role" className="mb-1 block text-xs font-medium">
            Role
          </label>
          <select id="new-role" name="role" className="input" defaultValue="requester">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted">
            {ROLE_DESCRIPTION.requester} Agents and admins can also see everybody&apos;s
            tickets.
          </p>
        </div>

        <div>
          <label htmlFor="new-password" className="mb-1 block text-xs font-medium">
            Initial password
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          {errors.password ? (
            <p className="mt-1 text-[11px] text-danger">{errors.password}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="status" className="text-[11px] text-muted">
          {state.status === "success" ? state.message : null}
          {state.status === "error" && !state.fieldErrors ? state.message : null}
        </span>
        <SubmitButton pendingLabel="Creating…">Create user</SubmitButton>
      </div>
    </form>
  );
}
