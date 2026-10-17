import Link from "next/link";
import { Suspense } from "react";

import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/auth";

/**
 * Authenticated application shell.
 *
 * `instant = false` documents the intent: every route below here needs the
 * session, so navigations may legitimately block on the server. The shell
 * itself still prerenders — the session-dependent parts are pushed into their
 * own `<Suspense>` boundaries instead of being awaited at the layout's top
 * level. See docs/architecture.md -> "Rendering model".
 */
export const instant = false;

async function NavWithSession() {
  const user = await getCurrentUser();
  return <AppNav isAdmin={user?.role === "admin"} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="grid size-6 place-items-center rounded-md bg-accent text-[11px] font-bold text-accent-contrast"
            >
              S
            </span>
            <span className="hidden sm:inline">Support Desk</span>
          </Link>

          <span aria-hidden="true" className="hidden h-4 w-px bg-line sm:block" />

          <Suspense fallback={<AppNav />}>
            <NavWithSession />
          </Suspense>

          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <ThemeToggle />
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-4 text-[11px] text-muted">
        Support Desk · internal support tracking
      </footer>
    </div>
  );
}
