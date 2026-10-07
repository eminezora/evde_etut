// Apply the committed Prisma migrations to the test database (fresh SQLite file, or the
// disposable PostgreSQL database given in TEST_POSTGRES_URL).
import { execFileSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "";
  const sqlite = url.startsWith("file:");
  if (sqlite && !url.includes("odev-claude-test-")) throw new Error("TEST_DATABASE_URL is not a fresh test database");
  execFileSync("node", ["scripts/db.mjs", sqlite ? "--sqlite" : "--postgres", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
