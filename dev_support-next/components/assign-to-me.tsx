"use client";

import { assignToMeAction } from "@/lib/actions/tickets";
import { SubmitButton } from "./submit-button";

/** Claims the ticket for the signed-in agent in one click. */
export function AssignToMeButton({ ticketId }: { ticketId: number }) {
  return (
    <form action={assignToMeAction}>
      <input type="hidden" name="ticketId" value={ticketId} />
      <SubmitButton
        className="btn btn-secondary btn-sm w-full"
        pendingLabel="Assigning…"
      >
        Assign to me
      </SubmitButton>
    </form>
  );
}
