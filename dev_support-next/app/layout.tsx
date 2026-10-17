import type { Metadata } from "next";

import { THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Support Desk",
    template: "%s · Support Desk",
  },
  description: "Submit and track internal support requests.",
  applicationName: "Support Desk",
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
};

/**
 * Root layout.
 *
 * Deliberately reads no cookies or headers, so the shell is static and
 * prerenderable. The only per-request work in here is the inline theme script,
 * which runs in the browser before first paint.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Sets `data-theme` before paint so a saved dark preference never
          // flashes light. See lib/theme.ts and docs/ui-guide.md.
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
