import type { Metadata } from "next";
import Link from "next/link";

import { TicketForm } from "@/components/ticket-form";

export const metadata: Metadata = {
  title: "New ticket",
};

/**
 * Creating a ticket needs no data, so this page is fully static. The Server
 * Action it posts to re-checks the session and validates every field.
 */
export default function NewTicketPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <header>
        <div className="text-[11px] text-muted">
          <Link href="/tickets" className="hover:text-foreground">
            ← All tickets
          </Link>
        </div>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">New ticket</h1>
        <p className="text-xs text-muted">
          Describe the problem once, in detail. You will get all replies in this
          ticket&apos;s thread.
        </p>
      </header>

      <TicketForm />
    </div>
  );
}
