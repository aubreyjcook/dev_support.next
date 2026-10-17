import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Coarse access gate.
 *
 * Proxy (the Next.js 16 replacement for `middleware`) only checks whether a
 * session cookie is *present*; it never touches the database, so it stays fast
 * and stateless. Real validation happens in the Data Access Layer on every
 * render and inside every Server Action.
 *
 * `/login` is excluded from the matcher: redirecting authenticated users away
 * from it would require validating the session here, and a stale cookie would
 * then bounce between `/` and `/login` forever.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
