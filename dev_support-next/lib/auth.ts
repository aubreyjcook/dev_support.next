/**
 * Authentication and authorization.
 *
 * Session model
 * -------------
 * - On sign-in a 32-byte random token is generated. The raw token goes into an
 *   `HttpOnly`, `SameSite=Lax` cookie; only its SHA-256 hash is stored in the
 *   `sessions` table. A leaked database dump therefore cannot be replayed as a
 *   session cookie.
 * - Sessions are server-side and revocable: deactivating a user or changing a
 *   password deletes their session rows.
 * - `getCurrentUser` is wrapped in React's `cache()` so a page that reads the
 *   session in several places (nav, header, data) only hits the database once
 *   per request.
 *
 * This module is the Data Access Layer: every page and Server Action derives
 * the acting user from the cookie here, never from client-supplied input.
 */
import { createHash, randomBytes } from "node:crypto";

import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isStaff, SESSION_COOKIE, type Role } from "@/lib/constants";
import { get, run } from "@/lib/db";
import { toRole } from "@/lib/users";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/**
 * Resolves the signed-in user for the current request, or `null`.
 * Memoized per request via React `cache()`.
 *
 * `io()` marks the read as request-time I/O. The session lookup depends on the
 * wall clock (expiry comparison), and With Cache Components any `new Date()` met
 * during a prerender pass is an error — without this marker the shell render
 * would reach the query and fail with "encountered the unstable value
 * `new Date()` while prerendering". `io()` suspends during prerendering and
 * resolves immediately during real requests and Server Actions, so every
 * route keeps its static shell and still reads the session per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  await io();

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<{ id: number; name: string; email: string; role: string }>(
    `SELECT u.id, u.name, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.expires_at > ?
        AND u.is_active = 1`,
    [hashToken(token), new Date().toISOString()],
  );
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: toRole(row.role),
  };
});

/** Requires any signed-in user; redirects to the login screen otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires an agent or admin. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect("/");
  return user;
}

/** Requires an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Creates a session row and sets the cookie. Server Actions only. */
export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);

  // Opportunistic cleanup keeps the table from growing without a cron job.
  run("DELETE FROM sessions WHERE expires_at <= ?", [now.toISOString()]);

  run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [hashToken(token), userId, now.toISOString(), expires.toISOString()],
  );

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

/** Destroys the current session row and clears the cookie. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    run("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}
