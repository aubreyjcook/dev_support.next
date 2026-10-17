#!/usr/bin/env node
/**
 * Deletes the local SQLite database (and its WAL side files) so the next request
 * recreates a fresh, migrated and seeded database.
 *
 * Usage: npm run db:reset
 *
 * Refuses to run when NODE_ENV=production unless --force is passed.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";

const force = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !force) {
  console.error(
    "Refusing to delete the database in production. Re-run with --force if you really mean it.",
  );
  process.exit(1);
}

const configured = process.env.DATABASE_PATH ?? "data/helpdesk.db";
const file = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);

if (!file.endsWith(".db")) {
  console.error(`Refusing to delete "${file}": expected a path ending in .db`);
  process.exit(1);
}

const targets = [file, `${file}-wal`, `${file}-shm`];
let removed = 0;

for (const target of targets) {
  if (existsSync(target)) {
    rmSync(target, { force: true });
    removed += 1;
    console.log(`removed ${target}`);
  }
}

if (removed === 0) {
  console.log(`nothing to remove at ${join(dirname(file), "")}`);
}

console.log("Database will be recreated (migrated + seeded) on the next request.");
