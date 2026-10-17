import { RoleBadge } from "@/components/badges";
import { Time } from "@/components/time";
import { isStaff, type Role } from "@/lib/constants";
import type { TicketMessage } from "@/lib/tickets";

function MessageCard({
  authorName,
  authorRole,
  body,
  createdAt,
  internal = false,
  title,
}: {
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
  internal?: boolean;
  title?: string;
}) {
  return (
    <li>
      <article
        className={[
          "card p-3",
          internal ? "border-dashed bg-surface-muted/60" : "",
        ].join(" ")}
      >
        <header className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span className="font-medium text-foreground">{authorName}</span>
          {isStaff(authorRole) ? <RoleBadge role={authorRole} /> : null}
          {title ? <span className="text-muted">{title}</span> : null}
          <span aria-hidden="true">·</span>
          <Time value={createdAt} />
          {internal ? <span className="badge badge-amber">Internal note</span> : null}
        </header>
        <p className="prose-ticket text-[13px] leading-relaxed">{body}</p>
      </article>
    </li>
  );
}

/**
 * Conversation view: the original request followed by every visible message.
 * Internal notes are only ever passed in for staff viewers (filtered in SQL).
 */
export function TicketThread({
  description,
  requester,
  createdAt,
  messages,
}: {
  description: string;
  requester: { name: string; role: Role };
  createdAt: string;
  messages: TicketMessage[];
}) {
  return (
    <ol className="space-y-3">
      <MessageCard
        authorName={requester.name}
        authorRole={requester.role}
        body={description}
        createdAt={createdAt}
        title="opened this ticket"
      />
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          authorName={message.authorName}
          authorRole={message.authorRole}
          body={message.body}
          createdAt={message.createdAt}
          internal={message.visibility === "internal"}
        />
      ))}
    </ol>
  );
}
