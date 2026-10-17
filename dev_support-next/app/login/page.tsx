import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Sign-in screen.
 *
 * Fully static: it renders no session data. Access control for the app itself
 * happens in `proxy.ts` (cookie presence) and again in the data layer.
 * Demo credentials are only advertised outside production builds.
 */
export default function LoginPage() {
  const showDemoAccounts = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-6 place-items-center rounded-md bg-accent text-[11px] font-bold text-accent-contrast"
          >
            S
          </span>
          Support Desk
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-24 pt-12 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="card p-6">
            <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
            <p className="mb-5 mt-1 text-xs text-muted">
              Use the account your administrator created for you.
            </p>
            <LoginForm />
          </div>

          {showDemoAccounts ? (
            <div className="mt-4 rounded-lg border border-dashed border-line-strong px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted">
                Demo accounts (development only)
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">
                ada@helpdesk.local · admin
                <br />
                maya@helpdesk.local · agent
                <br />
                nina@helpdesk.local · requester
                <br />
                password: {process.env.SEED_PASSWORD ?? "helpdesk123"}
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
