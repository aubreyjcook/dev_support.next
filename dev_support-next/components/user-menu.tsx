import Link from "next/link";

import { signOut } from "@/lib/actions/session";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/format";

/**
 * Current user + sign out. Resolves the session, so the app layout renders it
 * inside a `<Suspense>` boundary and keeps the rest of the chrome static.
 */
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="btn btn-primary btn-sm">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-[13px] font-medium">{user.name}</div>
        <div className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</div>
      </div>

      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-[11px] font-semibold text-muted-strong"
      >
        {initials(user.name)}
      </span>

      <form action={signOut}>
        <button type="submit" className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </form>
    </div>
  );
}

/** Stable placeholder so the header does not jump when the session resolves. */
export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="skeleton hidden h-7 w-24 sm:block" />
      <div className="skeleton size-7 rounded-full" />
      <div className="skeleton h-6 w-16" />
    </div>
  );
}
