#!/usr/bin/env node
// Runs a Prisma CLI command with the schema that matches DATABASE_URL:
//   file:…            → prisma/dev-sqlite/schema.prisma (local development / tests)
//   anything else     → prisma/schema.prisma (PostgreSQL, production / Vercel)
// `--sqlite` / `--postgres` force a schema (used by the test runners).
//
//   node scripts/db.mjs generate
//   node scripts/db.mjs migrate deploy
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Same precedence as Next.js for the keys we need: .env.production.local, .env.local, then .env.
  for (const file of [".env.production.local", ".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]*)"?\s*$/m);
    if (m) return m[1];
  }
  return "";
}

const args = process.argv.slice(2);
const force = args[0] === "--sqlite" || args[0] === "--postgres" ? args.shift() : null;
const sqlite = force ? force === "--sqlite" : databaseUrl().startsWith("file:");
const schema = sqlite ? "prisma/dev-sqlite/schema.prisma" : "prisma/schema.prisma";
console.error(`[db] ${sqlite ? "SQLite (dev)" : "PostgreSQL"} schema: ${schema}`);
execFileSync("npx", ["prisma", ...args, "--schema", schema], { stdio: "inherit" });
