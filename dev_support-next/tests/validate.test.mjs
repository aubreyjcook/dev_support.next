/**
 * Unit tests for the form validation accumulator used by every Server Action.
 *
 * Run with `npm test`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createAccumulator,
  isEmail,
  normalizeEmail,
  readText,
} from "../lib/validate.ts";

function form(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

test("readText trims strings and ignores non-text entries", () => {
  assert.equal(readText(form({ a: "  hi  " }), "a"), "hi");
  assert.equal(readText(form({}), "a"), "");
  const withFile = new FormData();
  withFile.set("file", new Blob(["x"]), "x.txt");
  assert.equal(readText(withFile, "file"), "");
});

test("isEmail accepts normal addresses and rejects malformed ones", () => {
  assert.equal(isEmail("maya@helpdesk.local"), true);
  assert.equal(isEmail("a.b+tag@example.co.uk"), true);
  assert.equal(isEmail("nope"), false);
  assert.equal(isEmail("a@b"), false);
  assert.equal(isEmail("a b@c.dev"), false);
});

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  Maya@Example.COM "), "maya@example.com");
});

test("text validates required, min and max lengths", () => {
  const required = createAccumulator();
  required.text(form({ subject: "" }), "subject", { label: "Subject", max: 10 });
  assert.equal(required.valid(), false);
  assert.equal(required.errors.subject, "Subject is required.");

  const tooShort = createAccumulator();
  tooShort.text(form({ subject: "ab" }), "subject", {
    label: "Subject",
    min: 3,
    max: 10,
  });
  assert.equal(tooShort.errors.subject, "Subject must be at least 3 characters.");

  const tooLong = createAccumulator();
  tooLong.text(form({ subject: "abcdefghijk" }), "subject", {
    label: "Subject",
    min: 3,
    max: 10,
  });
  assert.equal(tooLong.errors.subject, "Subject must be 10 characters or fewer.");

  const valid = createAccumulator();
  const value = valid.text(form({ subject: "  printer jam  " }), "subject", {
    label: "Subject",
    min: 3,
    max: 20,
  });
  assert.equal(value, "printer jam");
  assert.equal(valid.valid(), true);
});

test("email and password helpers report field-level errors", () => {
  const input = createAccumulator();
  input.email(form({ email: "bad" }), "email");
  input.password(form({ password: "short" }), "password");
  assert.equal(input.errors.email, "Enter a valid email address.");
  assert.equal(input.errors.password, "Password must be at least 8 characters.");
  assert.equal(input.valid(), false);
});

test("password confirmation must match", () => {
  const input = createAccumulator();
  input.password(form({ password: "longenough", confirm: "different" }), "password", {
    confirmKey: "confirm",
  });
  assert.equal(input.errors.confirm, "Passwords do not match.");
});

test("oneOf falls back to the default and flags unknown values", () => {
  const valid = createAccumulator();
  assert.equal(
    valid.oneOf(form({ priority: "urgent" }), "priority", ["low", "urgent"], {
      label: "Priority",
      fallback: "low",
    }),
    "urgent",
  );
  assert.equal(valid.valid(), true);

  const fallback = createAccumulator();
  assert.equal(
    fallback.oneOf(form({}), "priority", ["low", "high"], {
      label: "Priority",
      fallback: "low",
    }),
    "low",
  );
  assert.equal(fallback.valid(), true);

  const invalid = createAccumulator();
  invalid.oneOf(form({ priority: "banana" }), "priority", ["low", "high"], {
    label: "Priority",
    fallback: "low",
  });
  assert.equal(invalid.errors.priority, "Choose a valid priority.");
});

test("id rejects non-positive and non-numeric values", () => {
  const missing = createAccumulator();
  missing.id(form({}), "ticketId", "Ticket");
  assert.equal(missing.errors.ticketId, "Ticket is required.");

  const invalid = createAccumulator();
  invalid.id(form({ ticketId: "-3" }), "ticketId", "Ticket");
  assert.equal(invalid.errors.ticketId, "Ticket is invalid.");

  const valid = createAccumulator();
  assert.equal(valid.id(form({ ticketId: "12" }), "ticketId"), 12);
  assert.equal(valid.valid(), true);
});

test("accumulator keeps the first error per field", () => {
  const input = createAccumulator();
  input.fail("subject", "first");
  input.fail("subject", "second");
  assert.equal(input.errors.subject, "first");
});
