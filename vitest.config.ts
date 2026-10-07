import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Default: a brand-new SQLite file per run (nothing is reset or deleted).
// `npm run test:postgres` with TEST_POSTGRES_URL runs the same suite against a PostgreSQL database
// (use an empty, disposable database – never production).
// global-setup applies the committed migrations, so they are exercised too.
const testDatabaseUrl = process.env.TEST_POSTGRES_URL ?? `file:${join(tmpdir(), `odev-claude-test-${process.pid}-${Date.now()}.db`)}`;
process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // All test files share one test database.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
    },
  },
});
