import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_SHORT,
  STATUS_TONE,
  type Category,
  type Priority,
  type Role,
  type Status,
} from "@/lib/constants";

type Tone = "blue" | "amber" | "violet" | "emerald" | "zinc" | "red";

const TONE_CLASS: Record<Tone, string> = {
  blue: "badge-blue",
  amber: "badge-amber",
  violet: "badge-violet",
  emerald: "badge-emerald",
  zinc: "badge-zinc",
  red: "badge-red",
};

export function StatusBadge({ status, short = false }: { status: Status; short?: boolean }) {
  return (
    <span className={`badge ${TONE_CLASS[STATUS_TONE[status]]}`}>
      <span className="badge-dot" aria-hidden="true" />
      {short ? STATUS_SHORT[status] : STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge ${TONE_CLASS[PRIORITY_TONE[priority]]}`}>
      <span className="badge-dot" aria-hidden="true" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category }) {
  return <span className="badge badge-zinc">{CATEGORY_LABEL[category]}</span>;
}

const ROLE_TONE: Record<Role, Tone> = {
  requester: "zinc",
  agent: "blue",
  admin: "violet",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${TONE_CLASS[ROLE_TONE[role]]}`}>{ROLE_LABEL[role]}</span>;
}

/** Marks a ticket where the requester spoke last, i.e. support owes a reply. */
export function AwaitingDot({ label = "Awaiting reply from support" }: { label?: string }) {
  return (
    <span
      className="badge-dot badge-amber"
      role="img"
      aria-label={label}
      title={label}
    />
  );
}
