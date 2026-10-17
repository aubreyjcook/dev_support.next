import Link from "next/link";

/** Not-found boundary for authenticated routes: keeps the app chrome intact. */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-[11px] text-muted">404</p>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">Ticket not found</h1>
      <p className="mt-1 text-xs text-muted">
        It may have been removed, or it belongs to somebody else.
      </p>
      <Link href="/tickets" className="btn btn-primary btn-sm mt-4">
        Back to tickets
      </Link>
    </div>
  );
}
