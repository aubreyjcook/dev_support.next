/**
 * Password hashing (scrypt from `node:crypto`, no third-party dependency).
 *
 * Storage format: `scrypt$<N>$<r>$<p>$<salt-base64url>$<key-base64url>`
 *
 * Parameters can be raised later without invalidating existing hashes because
 * each stored hash carries the parameters it was created with.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16_384; // CPU/memory cost (~16 MiB with r=8)
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    // scrypt needs 128 * N * r bytes; give it headroom over the 32 MiB default.
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, rawN, rawR, rawP, saltPart, keyPart] = parts;
  const N = Number.parseInt(rawN, 10);
  const r = Number.parseInt(rawR, 10);
  const p = Number.parseInt(rawP, 10);
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) {
    return false;
  }

  let expected: Buffer;
  try {
    expected = Buffer.from(keyPart, "base64url");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, Buffer.from(saltPart, "base64url"), expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
