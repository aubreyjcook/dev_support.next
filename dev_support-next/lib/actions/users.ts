"use server";

/**
 * User administration Server Actions (admin only).
 *
 * Safety rails:
 *  - an admin cannot change their own role or deactivate themselves, which
 *    would otherwise lock the organization out of user management;
 *  - the last remaining active admin can never be demoted or deactivated;
 *  - changing a password revokes that user's sessions (see `lib/users.ts`).
 */
import { revalidatePath } from "next/cache";

import { failure, success, type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { isRole, ROLES, type Role } from "@/lib/constants";
import { hashPassword } from "@/lib/password";
import {
  countAdmins,
  createUser,
  findUserByEmail,
  findUserById,
  setUserActive,
  updateUserPassword,
  updateUserRole,
} from "@/lib/users";
import { createAccumulator, readText } from "@/lib/validate";

function revalidateAdminSurfaces(): void {
  revalidatePath("/admin/users");
}

export async function createUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const input = createAccumulator();
  const name = input.text(formData, "name", { label: "Full name", min: 2, max: 80 });
  const email = input.email(formData, "email");
  const role = input.oneOf<Role>(formData, "role", ROLES, {
    label: "Role",
    fallback: "requester",
  });
  const password = input.password(formData, "password", { min: 8 });

  if (!input.valid()) {
    return failure("Please correct the highlighted fields.", { ...input.errors });
  }

  if (findUserByEmail(email)) {
    return failure("That email address is already in use.", {
      email: "That email address is already in use.",
    });
  }

  createUser({ email, name, role, passwordHash: hashPassword(password) });
  revalidateAdminSurfaces();
  return success(`${name} can now sign in with ${email}.`);
}

export async function updateUserRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = Number(readText(formData, "userId"));
  const role = readText(formData, "value");
  if (!isRole(role)) return failure("Choose a valid role.");

  const target = Number.isSafeInteger(userId) ? findUserById(userId) : undefined;
  if (!target) return failure("That user does not exist.");

  if (target.id === admin.id) {
    return failure("You cannot change your own role.");
  }
  if (target.role === "admin" && role !== "admin" && countAdmins() <= 1) {
    return failure("At least one active admin is required.");
  }

  updateUserRole(target.id, role);
  revalidateAdminSurfaces();
  return success(`${target.name} is now a ${role}.`);
}

export async function setUserActiveAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const userId = Number(readText(formData, "userId"));
  const active = readText(formData, "value") === "active";

  const target = Number.isSafeInteger(userId) ? findUserById(userId) : undefined;
  if (!target) return failure("That user does not exist.");

  if (target.id === admin.id) {
    return failure("You cannot deactivate your own account.");
  }
  if (!active && target.role === "admin" && countAdmins() <= 1) {
    return failure("At least one active admin is required.");
  }

  setUserActive(target.id, active);
  revalidateAdminSurfaces();
  return success(`${target.name} is now ${active ? "active" : "deactivated"}.`);
}

export async function resetPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const input = createAccumulator();
  const userId = input.id(formData, "userId", "User");
  const password = input.password(formData, "password", { min: 8 });

  if (!input.valid()) {
    return failure("Please correct the highlighted fields.", { ...input.errors });
  }

  const target = findUserById(userId);
  if (!target) return failure("That user does not exist.");

  updateUserPassword(target.id, hashPassword(password));
  revalidateAdminSurfaces();
  return success(`Password updated for ${target.name}. Their sessions were signed out.`);
}
