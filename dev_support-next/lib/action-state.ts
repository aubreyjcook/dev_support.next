/**
 * Shape returned by every form-bound Server Action and consumed by
 * `useActionState` in the client form components.
 *
 * `stamp` changes on every success so a form can distinguish "still the same
 * result" from "a new submission succeeded" and reset itself exactly once.
 */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  stamp?: number;
}

export const IDLE_STATE: ActionState = { status: "idle" };

/** Signature shared by every form-bound Server Action. */
export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function success(message: string): ActionState {
  return { status: "success", message, stamp: Date.now() };
}

export function failure(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}
