import { afterAll, describe, expect, it } from "vitest";

// Seeding 1,706 records several times is slow on a single-connection PostgreSQL (e.g. `prisma dev`).
const SEED_TIMEOUT = 300_000;
import { groupDataset, seedCurriculum } from "../src/lib/curriculum/seed-curriculum.ts";
import { dataset, db } from "./helpers.ts";

afterAll(() => db.$disconnect());

describe("curriculum seed", () => {
  it("imports every unique subject+grade+outcomeCode once and creates no duplicates on re-run", async () => {
    const { groups } = groupDataset(dataset);
    const first = await seedCurriculum(db, dataset);
    expect(first.outcomes).toBe(groups.size);
    expect(await db.curriculumOutcome.count()).toBe(groups.size);
    expect(await db.curriculumOutcomeUnit.count()).toBe(dataset.length);

    const second = await seedCurriculum(db, dataset);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(groups.size);
    expect(await db.curriculumOutcome.count()).toBe(groups.size);
    expect(await db.curriculumOutcomeUnit.count()).toBe(dataset.length);

    const dupes = await db.curriculumOutcome.groupBy({ by: ["subject", "grade", "outcomeCode"], _count: true, having: { id: { _count: { gt: 1 } } } });
    expect(dupes).toHaveLength(0);
  }, SEED_TIMEOUT);

  it("updates an existing outcome when the dataset text changes", async () => {
    const target = dataset.find((r) => r.outcomeCode === "MAT.5.1.1")!;
    const changed = dataset.map((r) => (r === target ? { ...r, outcomeText: `${r.outcomeText} (güncel)` } : r));
    await seedCurriculum(db, changed);
    const row = await db.curriculumOutcome.findUnique({ where: { subject_grade_outcomeCode: { subject: "Matematik", grade: 5, outcomeCode: "MAT.5.1.1" } } });
    expect(row!.outcomeText).toBe(`${target.outcomeText} (güncel)`);
    await seedCurriculum(db, dataset);
    const restored = await db.curriculumOutcome.findUnique({ where: { id: row!.id } });
    expect(restored!.outcomeText).toBe(target.outcomeText);
  }, SEED_TIMEOUT);

  it("keeps REVIEW_REQUIRED outcomes in the database with their status", async () => {
    const expected = [...groupDataset(dataset).groups.values()].filter((g) => g.reviewStatus === "REVIEW_REQUIRED").length;
    expect(expected).toBeGreaterThan(0);
    expect(await db.curriculumOutcome.count({ where: { reviewStatus: "REVIEW_REQUIRED" } })).toBe(expected);
  });

  it("links a Türkçe outcome to every theme it appears in", async () => {
    const themes = new Set(dataset.filter((r) => r.grade === 5 && r.outcomeCode === "T.O.5.20").map((r) => r.unitOrTheme));
    const outcome = await db.curriculumOutcome.findFirst({ where: { grade: 5, outcomeCode: "T.O.5.20" }, include: { units: true } });
    expect(themes.size).toBeGreaterThan(1);
    expect(new Set(outcome!.units.map((u) => u.unitOrTheme))).toEqual(themes);
  });
});
