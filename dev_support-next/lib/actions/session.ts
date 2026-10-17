"use server";

/**
 * Sign-in / sign-out Server Actions.
 *
 * These are directly POST-able, so they validate their own input and never
 * trust anything from the client beyond the submitted credentials.
 */
import { redirect } from "next/navigation";

import { failure, type ActionState } from "@/lib/action-state";
import { endSession, startSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { findUserByEmail } from "@/lib/users";
import { createAccumulator } from "@/lib/validate";

export async function signIn(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const input = createAccumulator();
  const email = input.email(formData, "email");
  const password = input.text(formData, "password", {
    label: "Password",
    min: 1,
    max: 200,
  });

  if (!input.valid()) {
    return failure("Enter your email and password.", { ...input.errors });
  }

  const account = findUserByEmail(email);

  if (!account || account.is_active !== 1) {
    // Burn a comparable amount of CPU so a missing account is not detectable
    // by response time.
    hashPassword(password);
    return failure("Email or password is incorrect.");
  }

  if (!verifyPassword(password, account.password_hash)) {
    return failure("Email or password is incorrect.");
  }

  await startSession(account.id);
  redirect("/");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/login");
}
