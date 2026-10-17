import type { Metadata } from "next";
import { Suspense } from "react";

import { TicketView } from "@/components/ticket-detail";

/**
 * Metadata is intentionally static: awaiting `params` or the database inside
 * `generateMetadata` would block the entire static shell of the route.
 */
export const metadata: Metadata = {
  title: "Ticket",
};

function TicketSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-3 w-32" />
      <div className="skeleton h-6 w-2/3" />
      <div className="skeleton h-5 w-56" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-3">
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
          <div className="skeleton h-32" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-32" />
          <div className="skeleton h-24" />
        </div>
      </div>
    </div>
  );
}

export default function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  return (
    <Suspense fallback={<TicketSkeleton />}>
      <TicketView params={params} />
    </Suspense>
  );
}
