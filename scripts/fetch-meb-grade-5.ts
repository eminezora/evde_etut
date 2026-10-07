// Kept for compatibility: same as `npm run curriculum:fetch:5`.
import { buildGrade } from "../src/lib/curriculum/build-grade.ts";
import { validateGrade } from "../src/lib/curriculum/validate-outcomes.ts";

await buildGrade(5, { refresh: process.argv.includes("--refresh") });
await validateGrade(5);
