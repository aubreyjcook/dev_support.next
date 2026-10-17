import Link from "next/link";

/** Fallback for URLs that match no route at all. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[11px] text-muted">404</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 max-w-sm text-xs text-muted">
        The address you followed does not exist in this application.
      </p>
      <Link href="/" className="btn btn-primary btn-sm mt-4">
        Go to the overview
      </Link>
    </div>
  );
}
