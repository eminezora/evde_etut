import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "data/**", "next-env.d.ts", "prisma/migrations/**"]),
  {
    // The MEB scraper pipeline works on untyped raw page JSON; `any` is deliberate there.
    files: ["src/lib/curriculum/build-grade.ts", "src/lib/curriculum/validate-outcomes.ts", "scripts/lib-cli.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);
