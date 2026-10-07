import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(new URL(`../prisma/${f}`, import.meta.url), "utf8");
const body = (s: string) => s.slice(s.indexOf("generator client")).replace('provider = "postgresql"', 'provider = "sqlite"');

describe("prisma schemas", () => {
  it("keeps the SQLite dev schema identical to the PostgreSQL production schema (except the provider)", () => {
    expect(body(read("dev-sqlite/schema.prisma"))).toBe(body(read("schema.prisma")));
  });
});
