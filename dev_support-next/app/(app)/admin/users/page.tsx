import type { Metadata } from "next";
import { Suspense } from "react";

import { UsersAdmin } from "@/components/users-admin";

export const metadata: Metadata = {
  title: "Users",
};

function UsersSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-40" />
      <div className="skeleton h-64" />
    </div>
  );
}

/** Admin-only. The gate is enforced again inside `UsersAdmin` and every action. */
export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        <p className="text-xs text-muted">
          Who can sign in, what they can see, and how they get access.
        </p>
      </header>

      <Suspense fallback={<UsersSkeleton />}>
        <UsersAdmin />
      </Suspense>
    </div>
  );
}
