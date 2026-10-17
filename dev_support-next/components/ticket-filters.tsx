"use client";

import { useRef, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, STATUSES } from "@/lib/constants";
import type { TicketFilters } from "@/lib/filters";

/**
 * Ticket search + filters.
 *
 * The controls are uncontrolled and read their `defaultValue` from the URL, so
 * selecting a value updates the DOM immediately (no round trip, no controlled
 * input bookkeeping). Changing a `<select>` navigates; typing submits on Enter.
 * Without JavaScript the form still works as a plain GET form.
 */
export function TicketFiltersForm({
  basePath,
  filters,
  showAssignee,
}: {
  basePath: string;
  filters: TicketFilters;
  showAssignee: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function navigate(entries: Iterable<[string, FormDataEntryValue]>) {
    const params = new URLSearchParams();
    for (const [key, value] of entries) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
    });
  }

  function submit() {
    const form = formRef.current;
    if (!form) return;
    navigate(new FormData(form).entries());
  }

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    const target = event.target as HTMLElement;
    if (target.tagName === "SELECT") submit();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Client-side navigation instead of a full page load.
    event.preventDefault();
    submit();
  }

  return (
    <form
      ref={formRef}
      action={basePath}
      method="get"
      role="search"
      onChange={handleChange}
      onSubmit={handleSubmit}
      data-pending={pending ? "" : undefined}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        placeholder="Search subject or SUP-0007"
        aria-label="Search tickets"
        className="input input-sm w-full sm:w-60"
        maxLength={100}
      />

      <select
        name="status"
        defaultValue={filters.status}
        aria-label="Filter by status"
        className="input input-sm w-auto"
      >
        <option value="all">Any status</option>
        <option value="active">Active (open work)</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </select>

      <select
        name="priority"
        defaultValue={filters.priority}
        aria-label="Filter by priority"
        className="input input-sm w-auto"
      >
        <option value="all">Any priority</option>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABEL[priority]}
          </option>
        ))}
      </select>

      {showAssignee ? (
        <select
          name="assignee"
          defaultValue={filters.assignee}
          aria-label="Filter by assignee"
          className="input input-sm w-auto"
        >
          <option value="any">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
      ) : null}

      {/** Category is intentionally not a filter: six always-visible values add
          more chrome than they save. It stays searchable on each ticket view. */}

      <noscript>
        <button type="submit" className="btn btn-secondary btn-sm">
          Apply
        </button>
      </noscript>

      <span aria-live="polite" className="text-[11px] text-muted">
        {pending ? "Filtering…" : ""}
      </span>
    </form>
  );
}
