"use server";

/**
 * Ticket Server Actions.
 *
 * Rules that hold for every action in this file:
 *  1. The acting user is re-derived from the session cookie (`requireUser` /
 *     `requireStaff`). Authorization never comes from the client.
 *  2. Row-level access is re-checked through `getTicketDetail(id, user)`, which
 *     scopes requesters to their own tickets.
 *  3. Input is validated before any write; helpers below keep the actions
 *     readable.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { failure, success, type ActionState } from "@/lib/action-state";
import { requireStaff, requireUser } from "@/lib/auth";
import {
  CATEGORIES,
  isPriority,
  isStaff,
  isStatus,
  PRIORITIES,
  type Priority,
} from "@/lib/constants";
import {
  addMessage,
  createTicket,
  getTicketDetail,
  setTicketAssignee,
  setTicketCategory,
  setTicketPriority,
  setTicketStatus,
} from "@/lib/tickets";
import { findUserById, toRole } from "@/lib/users";
import { createAccumulator, readText } from "@/lib/validate";

/** Refreshes every route that renders ticket data. */
function revalidateTicketSurfaces(ticketId?: number): void {
  revalidatePath("/");
  revalidatePath("/tickets");
  if (ticketId !== undefined) {
    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath("/tickets/[id]", "page");
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTicketAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const input = createAccumulator();
  const subject = input.text(formData, "subject", {
    label: "Subject",
    min: 3,
    max: 120,
  });
  const description = input.text(formData, "description", {
    label: "Description",
    min: 10,
    max: 8000,
  });
  const priority = input.oneOf<Priority>(formData, "priority", PRIORITIES, {
    label: "Priority",
    fallback: "normal",
  });
  const category = input.oneOf(formData, "category", CATEGORIES, {
    label: "Category",
    fallback: "other",
  });

  if (!input.valid()) {
    return failure("Please correct the highlighted fields.", { ...input.errors });
  }

  const ticketId = createTicket({
    subject,
    description,
    priority,
    category,
    requester: { id: user.id, name: user.name },
  });

  revalidateTicketSurfaces(ticketId);
  redirect(`/tickets/${ticketId}`);
}

/* -------------------------------------------------------------------------- */
/* Conversation                                                                */
/* -------------------------------------------------------------------------- */

export async function addMessageAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const input = createAccumulator();
  const ticketId = input.id(formData, "ticketId", "Ticket");
  const body = input.text(formData, "body", {
    label: "Message",
    min: 2,
    max: 8000,
  });
  const wantsInternalNote = readText(formData, "visibility") === "internal";
  const visibility = wantsInternalNote && isStaff(user.role) ? "internal" : "public";

  if (!input.valid()) {
    return failure("Please correct the highlighted fields.", { ...input.errors });
  }

  const ticket = getTicketDetail(ticketId, user);
  if (!ticket) return failure("That ticket does not exist or is not yours.");

  addMessage({
    ticketId,
    author: { id: user.id, name: user.name, role: user.role },
    body,
    visibility,
  });

  revalidateTicketSurfaces(ticketId);
  return success(visibility === "internal" ? "Internal note added." : "Reply posted.");
}

/* -------------------------------------------------------------------------- */
/* Properties (staff only)                                                     */
/* -------------------------------------------------------------------------- */

export async function setTicketFieldAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();

  const ticketId = Number(readText(formData, "ticketId"));
  const field = readText(formData, "field");
  const value = readText(formData, "value");

  const ticket = getTicketDetail(ticketId, user);
  if (!ticket) return failure("That ticket does not exist.");

  const actor = { id: user.id, name: user.name };

  switch (field) {
    case "status": {
      if (!isStatus(value)) return failure("Choose a valid status.");
      setTicketStatus(ticketId, value, actor);
      break;
    }
    case "priority": {
      if (!isPriority(value)) return failure("Choose a valid priority.");
      setTicketPriority(ticketId, value, actor);
      break;
    }
    case "category": {
      if (!CATEGORIES.includes(value as (typeof CATEGORIES)[number])) {
        return failure("Choose a valid category.");
      }
      setTicketCategory(ticketId, value as (typeof CATEGORIES)[number], actor);
      break;
    }
    case "assignee": {
      if (value === "" || value === "unassigned") {
        setTicketAssignee(ticketId, null, actor);
        break;
      }
      const id = Number(value);
      const target = Number.isSafeInteger(id) ? findUserById(id) : undefined;
      if (!target || target.is_active !== 1 || !isStaff(toRole(target.role))) {
        return failure("That person cannot be assigned tickets.");
      }
      setTicketAssignee(ticketId, { id: target.id, name: target.name }, actor);
      break;
    }
    default:
      return failure("Unknown field.");
  }

  revalidateTicketSurfaces(ticketId);
  return success("Ticket updated.");
}

/** One-click claim used by the "Assign to me" button. */
export async function assignToMeAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const ticketId = Number(readText(formData, "ticketId"));

  const ticket = getTicketDetail(ticketId, user);
  if (!ticket) return;

  setTicketAssignee(ticketId, { id: user.id, name: user.name }, {
    id: user.id,
    name: user.name,
  });
  revalidateTicketSurfaces(ticketId);
}

/* -------------------------------------------------------------------------- */
/* Requester self-service                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Lets a requester close their own ticket (confirming it is resolved) or
 * reopen it. Staff use `setTicketFieldAction` instead.
 */
export async function setOwnTicketStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const ticketId = Number(readText(formData, "ticketId"));
  const value = readText(formData, "value");
  if (value !== "open" && value !== "closed") {
    return failure("Unsupported action.");
  }

  // Scoped read: a requester can only resolve tickets they can already see.
  const ticket = getTicketDetail(ticketId, user);
  if (!ticket) return failure("That ticket does not exist or is not yours.");

  setTicketStatus(ticketId, value, { id: user.id, name: user.name });
  revalidateTicketSurfaces(ticketId);
  return success(value === "closed" ? "Ticket closed." : "Ticket reopened.");
}
