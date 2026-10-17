/**
 * Tiny, dependency-free validation helpers.
 *
 * Server Actions are directly POST-able, so every mutation parses and
 * validates its `FormData` through this module before touching the database.
 * The same helpers back the inline error messages the UI renders, which keeps
 * client-facing and server-side rules in one place.
 *
 * The API is a small accumulator so a single action can report every invalid
 * field at once instead of failing on the first one.
 */

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

export interface LengthRule {
  /** Shortest accepted length after trimming. */
  min?: number;
  /** Longest accepted length, counted after trimming. */
  max: number;
  /** Field label used in the generated message ("Subject is required"). */
  label: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Reads a `FormData` entry as a trimmed string. Missing / non-text -> `""`. */
export function readText(data: FormData, key: string): string {
  const raw = data.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

/** Lowercases and trims an email address. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function isSafeInt(value: string | number): boolean {
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0;
}

export interface Accumulator {
  /** Field name -> message. Empty when everything checked so far is valid. */
  readonly errors: FieldErrors;
  /** Records a message for a field unless one is already present. */
  fail(field: string, message: string): void;
  /** True when no errors have been recorded. */
  valid(): boolean;
  /**
   * Validates trimmed text length. Returns the trimmed value regardless, so a
   * partially invalid form can still be re-rendered with the user's input.
   */
  text(data: FormData, key: string, rule: LengthRule): string;
  /** Validates an email address. */
  email(data: FormData, key: string, label?: string): string;
  /** Validates a password (length + optional confirmation field). */
  password(
    data: FormData,
    key: string,
    options?: { label?: string; min?: number; confirmKey?: string },
  ): string;
  /** Validates a value against a fixed set of options. */
  oneOf<T extends string>(
    data: FormData,
    key: string,
    options: readonly T[],
    rule: { label: string; fallback: T },
  ): T;
  /** Validates a positive integer id. */
  id(data: FormData, key: string, label?: string): number;
}

export function createAccumulator(): Accumulator {
  const errors: FieldErrors = {};

  const fail = (field: string, message: string) => {
    if (!errors[field]) errors[field] = message;
  };

  const text = (data: FormData, key: string, rule: LengthRule): string => {
    const value = readText(data, key);
    const { min = 1, max, label } = rule;

    if (value.length === 0) {
      if (min > 0) fail(key, `${label} is required.`);
      return value;
    }
    if (value.length < min) {
      fail(key, `${label} must be at least ${min} characters.`);
    } else if (value.length > max) {
      fail(key, `${label} must be ${max} characters or fewer.`);
    }
    return value;
  };

  const email = (data: FormData, key: string, label = "Email"): string => {
    const value = normalizeEmail(readText(data, key));
    if (!value) {
      fail(key, `${label} is required.`);
    } else if (!isEmail(value)) {
      fail(key, "Enter a valid email address.");
    }
    return value;
  };

  const password = (
    data: FormData,
    key: string,
    options: { label?: string; min?: number; confirmKey?: string } = {},
  ): string => {
    const { label = "Password", min = 8, confirmKey } = options;
    const value = readText(data, key);
    if (!value) {
      fail(key, `${label} is required.`);
    } else if (value.length < min) {
      fail(key, `${label} must be at least ${min} characters.`);
    } else if (value.length > 200) {
      fail(key, `${label} must be 200 characters or fewer.`);
    }

    if (confirmKey) {
      const confirmation = readText(data, confirmKey);
      if (confirmation !== value && value.length > 0) {
        fail(confirmKey, "Passwords do not match.");
      }
    }
    return value;
  };

  const oneOf = <T extends string>(
    data: FormData,
    key: string,
    options: readonly T[],
    rule: { label: string; fallback: T },
  ): T => {
    const value = readText(data, key);
    if (!value) return rule.fallback;
    if (!(options as readonly string[]).includes(value)) {
      fail(key, `Choose a valid ${rule.label.toLowerCase()}.`);
      return rule.fallback;
    }
    return value as T;
  };

  const id = (data: FormData, key: string, label = "Record"): number => {
    const raw = readText(data, key);
    if (!raw) {
      fail(key, `${label} is required.`);
      return 0;
    }
    if (!isSafeInt(raw)) {
      fail(key, `${label} is invalid.`);
      return 0;
    }
    return Number.parseInt(raw, 10);
  };

  return {
    errors,
    fail,
    valid: () => Object.keys(errors).length === 0,
    text,
    email,
    password,
    oneOf,
    id,
  };
}

/** First error message, for compact one-line UI summaries. */
export function firstError(errors: FieldErrors): string | undefined {
  return Object.values(errors)[0];
}
