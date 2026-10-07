#!/usr/bin/env node
// Runs a Prisma CLI command with the schema that matches DATABASE_URL:
//   file:…            → prisma/dev-sqlite/schema.prisma (local development / tests)
//   anything else     → prisma/schema.prisma (PostgreSQL, production / Vercel)
// `--sqlite` / `--postgres` force a schema (used by the test runners). `--dev` resolves DATABASE_URL
// like `next dev` and the local scripts do (ignoring .env.production.local from `vercel env pull`).
//
//   node scripts/db.mjs generate
//   node scripts/db.mjs migrate deploy
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function databaseUrl(dev) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Same precedence as Next.js for the keys we need (production build vs. development).
  const files = dev ? [".env.development.local", ".env.local", ".env"] : [".env.production.local", ".env.local", ".env"];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]*)"?\s*$/m);
    if (m) return m[1];
  }
  return "";
}

const args = process.argv.slice(2);
const dev = args[0] === "--dev" ? Boolean(args.shift()) : false;
const force = args[0] === "--sqlite" || args[0] === "--postgres" ? args.shift() : null;
const resolvedUrl = databaseUrl(dev);
const sqlite = force ? force === "--sqlite" : resolvedUrl.startsWith("file:");
const schema = sqlite ? "prisma/dev-sqlite/schema.prisma" : "prisma/schema.prisma";
console.error(`[db] ${sqlite ? "SQLite (dev)" : "PostgreSQL"} schema: ${schema}`);
execFileSync("npx", ["prisma", ...args, "--schema", schema], {
  stdio: "inherit",
  env: { ...process.env, ...(resolvedUrl ? { DATABASE_URL: resolvedUrl } : {}) },
});
