// Fetch + parse + validate MEB curriculum data, grade by grade.
//
//   npm run curriculum:fetch                 # every configured grade (5–8), then the combined dataset
//   npm run curriculum:fetch -- --grade 6    # one grade (also: npm run curriculum:fetch:6)
//   npm run curriculum:fetch -- --refresh    # ignore the local HTML cache
import { buildGrade } from "../src/lib/curriculum/build-grade.ts";
import { validateGrade } from "../src/lib/curriculum/validate-outcomes.ts";
import { combineIfComplete, parseGrades } from "./lib-cli.ts";

const refresh = process.argv.includes("--refresh");
for (const grade of parseGrades()) {
  await buildGrade(grade, { refresh });
  await validateGrade(grade);
}
await combineIfComplete();
