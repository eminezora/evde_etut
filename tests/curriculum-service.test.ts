import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getAvailableGrades,
  getOutcomeById,
  getOutcomes,
  getOutcomesByIds,
  getSubjectsByGrade,
  getUnitsByGradeAndSubject,
} from "../src/lib/curriculum/curriculum-service.ts";
import { db, ensureCurriculum } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

describe("curriculum service filters", () => {
  it("returns grades and grade-specific subjects from the database", async () => {
    expect(await getAvailableGrades({ db })).toEqual([5, 6, 7, 8]);
    expect(await getSubjectsByGrade(5, { db })).toEqual(["Fen Bilimleri", "İngilizce", "Matematik", "Sosyal Bilgiler", "Türkçe"]);
    const grade8 = await getSubjectsByGrade(8, { db });
    expect(grade8).toContain("T.C. İnkılap Tarihi ve Atatürkçülük");
    expect(grade8).not.toContain("Sosyal Bilgiler");
  });

  it("returns themes/units for grade + subject in MEB order", async () => {
    const units = await getUnitsByGradeAndSubject(5, "Fen Bilimleri", { db });
    expect(units).toHaveLength(7);
    expect(units[0].unitOrTheme).toBe("1. Ünite: Gökyüzündeki Komşularımız Ve Biz");
    expect(units[6].unitOrTheme).toMatch(/^7\. Ünite/);
  });

  it("returns only the outcomes of the chosen grade + subject + theme", async () => {
    const outcomes = await getOutcomes({ grade: 5, subject: "Fen Bilimleri", unitOrTheme: "1. Ünite: Gökyüzündeki Komşularımız Ve Biz" }, { db });
    expect(outcomes.map((o) => o.outcomeCode)).toEqual(["FB.5.1.1", "FB.5.1.2", "FB.5.1.3", "FB.5.1.4"]);
    expect(outcomes.every((o) => o.grade === 5 && o.subject === "Fen Bilimleri" && o.reviewStatus === "VERIFIED")).toBe(true);
    expect(await getOutcomes({ grade: 6, subject: "Fen Bilimleri", unitOrTheme: "1. Ünite: Gökyüzündeki Komşularımız Ve Biz" }, { db })).toEqual([]);
  });

  it("never lists REVIEW_REQUIRED outcomes in the selection flow", async () => {
    const review = await db.curriculumOutcome.findMany({ where: { reviewStatus: "REVIEW_REQUIRED" }, include: { units: true } });
    expect(review.length).toBeGreaterThan(0);
    for (const o of review) {
      for (const u of o.units) {
        const listed = await getOutcomes({ grade: o.grade, subject: o.subject, unitOrTheme: u.unitOrTheme }, { db });
        expect(listed.map((x) => x.id)).not.toContain(o.id);
      }
      expect(await getOutcomeById(o.id, { db })).toBeNull();
    }
    expect(await getOutcomesByIds(review.map((o) => o.id), { db })).toEqual([]);
    // Explicit opt-in still sees them (admin/review use only).
    expect(await getOutcomeById(review[0].id, { db, includeUnverified: true })).not.toBeNull();
  });

  it("hides a theme whose outcomes are all REVIEW_REQUIRED", async () => {
    // Every outcome of the 5th-grade English theme "Life İn Nature" is REVIEW_REQUIRED (irregular codes on MEB).
    const units = await getUnitsByGradeAndSubject(5, "İngilizce", { db });
    expect(units.map((u) => u.unitOrTheme)).not.toContain("Life İn Nature");
    expect((await getUnitsByGradeAndSubject(5, "İngilizce", { db, includeUnverified: true })).map((u) => u.unitOrTheme)).toContain("Life İn Nature");
  });
});
