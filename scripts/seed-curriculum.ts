// Imports data/curriculum/normalized/all-middle-school.json into the database.
//
//   npm run curriculum
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { CURRICULUM_DIR, type OutcomeRecord } from "../src/lib/curriculum/curriculum-config.ts";
import { seedCurriculum } from "../src/lib/curriculum/seed-curriculum.ts";

const file = `${CURRICULUM_DIR}/normalized/all-middle-school.json`;
const dataset: { outcomes: OutcomeRecord[] } = JSON.parse(await readFile(file, "utf8"));
const prisma = new PrismaClient();
try {
  const started = Date.now();
  const stats = await seedCurriculum(prisma, dataset.outcomes);
  const total = await prisma.curriculumOutcome.count();
  const review = await prisma.curriculumOutcome.count({ where: { reviewStatus: "REVIEW_REQUIRED" } });
  console.log(JSON.stringify({ ...stats, dbTotal: total, dbReviewRequired: review, ms: Date.now() - started }, null, 2));
} finally {
  await prisma.$disconnect();
}
