"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary for authenticated routes.
 *
 * Uses the Next 16 `retry()` prop, which re-fetches and re-renders the segment.
 * Server-thrown errors are redacted by the framework; `error.digest` matches the
 * corresponding server log line.
 */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error
      ? (error as Error & { digest?: string }).digest
      : undefined;

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-1 text-xs text-muted">
        The page could not be loaded. Nothing was changed.
      </p>
      {digest ? (
        <p className="mt-2 font-mono text-[11px] text-muted">Reference: {digest}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn btn-primary btn-sm">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary btn-sm">
          Overview
        </Link>
      </div>
    </div>
  );
}
