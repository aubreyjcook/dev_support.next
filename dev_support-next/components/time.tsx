import { absoluteTime, isoString, relativeTime } from "@/lib/format";

/**
 * Server-rendered timestamp. Relative by default (compact and timezone
 * agnostic), with the exact UTC value available on hover.
 */
export function Time({
  value,
  mode = "relative",
  className,
}: {
  value: string;
  mode?: "relative" | "absolute";
  className?: string;
}) {
  return (
    <time
      dateTime={isoString(value)}
      title={absoluteTime(value)}
      className={className}
    >
      {mode === "relative" ? relativeTime(value) : absoluteTime(value)}
    </time>
  );
}
