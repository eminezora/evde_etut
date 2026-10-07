// Re-validate already fetched grades (no network) and rebuild the combined dataset.
//
//   npm run curriculum:validate               # every configured grade
//   npm run curriculum:validate -- --grade 7
import { validateGrade } from "../src/lib/curriculum/validate-outcomes.ts";
import { combineIfComplete, parseGrades } from "./lib-cli.ts";

for (const grade of parseGrades()) await validateGrade(grade);
await combineIfComplete();
