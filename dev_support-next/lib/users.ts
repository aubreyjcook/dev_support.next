/**
 * User queries. Pure data access — no request context, no authorization
 * decisions. Those live in `lib/auth.ts` and the Server Actions themselves.
 */
import { isRole, type Role } from "@/lib/constants";
import { all, get, nowIso, run } from "@/lib/db";

/** Raw row shape from the `users` table. Never send this to the client. */
export interface UserRecord {
  id: number;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  is_active: number;
  created_at: string;
}

/** Safe projection for UI and props. */
export interface UserSummary {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const USER_FIELDS = "id, email, name, role, password_hash, is_active, created_at";

export function toRole(value: string): Role {
  return isRole(value) ? value : "requester";
}

function toSummary(row: {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: number;
  created_at: string;
}): UserSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: toRole(row.role),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function findUserByEmail(email: string): UserRecord | undefined {
  return get<UserRecord>(`SELECT ${USER_FIELDS} FROM users WHERE email = ?`, [
    email.trim().toLowerCase(),
  ]);
}

export function findUserById(id: number): UserRecord | undefined {
  return get<UserRecord>(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`, [id]);
}

export function listUsers(): UserSummary[] {
  return all<{
    id: number;
    email: string;
    name: string;
    role: string;
    is_active: number;
    created_at: string;
  }>(
    `SELECT id, email, name, role, is_active, created_at
       FROM users
      ORDER BY is_active DESC, name COLLATE NOCASE ASC`,
  ).map(toSummary);
}

/** Active staff members that tickets can be assigned to. */
export function listAssignableUsers(): { id: number; name: string }[] {
  return all<{ id: number; name: string }>(
    `SELECT id, name
       FROM users
      WHERE is_active = 1 AND role IN ('agent', 'admin')
      ORDER BY name COLLATE NOCASE ASC`,
  );
}

export function countAdmins(): number {
  const row = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1",
  );
  return Number(row?.count ?? 0);
}

export interface NewUser {
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
}

export function createUser(input: NewUser): number {
  const result = run(
    `INSERT INTO users (email, name, role, password_hash, is_active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [input.email, input.name, input.role, input.passwordHash, nowIso()],
  );
  return result.lastInsertRowid;
}

export function updateUserRole(id: number, role: Role): void {
  run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
}

export function setUserActive(id: number, active: boolean): void {
  run("UPDATE users SET is_active = ? WHERE id = ?", [active ? 1 : 0, id]);
  // Deactivating a user must also invalidate their sessions immediately.
  if (!active) run("DELETE FROM sessions WHERE user_id = ?", [id]);
}

export function updateUserPassword(id: number, passwordHash: string): void {
  run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
  // Force a fresh sign-in everywhere after a password change.
  run("DELETE FROM sessions WHERE user_id = ?", [id]);
}
