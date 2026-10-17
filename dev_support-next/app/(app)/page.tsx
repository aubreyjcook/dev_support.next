import type { Metadata } from "next";
import { Suspense } from "react";

import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Overview",
};

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-4 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="skeleton h-16" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-56" />
        <div className="skeleton h-56" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Overview</h1>
        <p className="text-xs text-muted">A live summary of ticket activity.</p>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
