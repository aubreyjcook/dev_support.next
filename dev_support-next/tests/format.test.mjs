/**
 * Unit tests for the pure display helpers.
 *
 * Run with `npm test` (node:test). Node 24 strips TypeScript types natively, so
 * the app modules can be imported directly without a build step.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  absoluteTime,
  collapse,
  initials,
  isoString,
  pluralize,
  relativeTime,
  shortDate,
} from "../lib/format.ts";
import { parseTicketRef, ticketRef } from "../lib/constants.ts";

const NOW = Date.parse("2025-03-12T15:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("relativeTime collapses sub-minute deltas", () => {
  assert.equal(relativeTime(new Date(NOW - 5_000), NOW), "just now");
  assert.equal(relativeTime(new Date(NOW + 30_000), NOW), "just now");
});

test("relativeTime reports minutes, hours, days and weeks", () => {
  assert.equal(relativeTime(new Date(NOW - 12 * MINUTE), NOW), "12m ago");
  assert.equal(relativeTime(new Date(NOW - 3 * HOUR), NOW), "3h ago");
  assert.equal(relativeTime(new Date(NOW - 2 * DAY), NOW), "2d ago");
  assert.equal(relativeTime(new Date(NOW - 16 * DAY), NOW), "2w ago");
});

test("relativeTime falls back to an absolute date for old values", () => {
  assert.equal(relativeTime(new Date(NOW - 400 * DAY), NOW), "6 Feb 2024");
});

test("relativeTime and absoluteTime reject invalid input", () => {
  assert.equal(relativeTime("not-a-date", NOW), "unknown");
  assert.equal(absoluteTime("not-a-date"), "unknown");
});

test("absoluteTime is explicit about UTC", () => {
  assert.equal(absoluteTime("2025-03-12T09:05:00.000Z"), "12 Mar 2025, 09:05 UTC");
});

test("shortDate uses UTC so server and client agree", () => {
  assert.equal(shortDate("2025-12-31T23:30:00.000Z"), "31 Dec 2025");
});

test("isoString round-trips ISO timestamps", () => {
  assert.equal(isoString("2025-03-12T15:00:00.000Z"), "2025-03-12T15:00:00.000Z");
  assert.equal(isoString("nope"), "");
});

test("pluralize handles singular and plural", () => {
  assert.equal(pluralize(1, "ticket"), "1 ticket");
  assert.equal(pluralize(2, "ticket"), "2 tickets");
  assert.equal(pluralize(1, "reply", "replies"), "1 reply");
  assert.equal(pluralize(0, "reply", "replies"), "0 replies");
});

test("collapse flattens whitespace", () => {
  assert.equal(collapse("  a \n b\t c "), "a b c");
});

test("initials derives at most two letters", () => {
  assert.equal(initials("Ada Chen"), "AC");
  assert.equal(initials("Maya"), "MA");
  assert.equal(initials("   "), "?");
});

test("ticketRef pads to four digits and keeps growing beyond that", () => {
  assert.equal(ticketRef(1), "SUP-0001");
  assert.equal(ticketRef(42), "SUP-0042");
  assert.equal(ticketRef(12345), "SUP-12345");
});

test("parseTicketRef accepts the formats people actually type", () => {
  assert.equal(parseTicketRef("SUP-0007"), 7);
  assert.equal(parseTicketRef("sup-7"), 7);
  assert.equal(parseTicketRef("7"), 7);
  assert.equal(parseTicketRef("  SUP 12 "), 12);
  assert.equal(parseTicketRef("SUP-0"), null);
  assert.equal(parseTicketRef("abc"), null);
  assert.equal(parseTicketRef(""), null);
});
