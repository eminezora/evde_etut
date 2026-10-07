import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignmentSchema } from "../src/lib/assignments/assignment-schema.ts";
import { createAssignment, getAssignmentForTeacher } from "../src/lib/assignments/assignment-service.ts";
import { db, ensureCurriculum, inDays, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

const base = (classroomId: string, subject: string, unitOrTheme: string, outcomeIds: string[]) => ({
  classroomId,
  subject,
  unitOrTheme,
  topic: "Test konusu",
  outcomeIds,
  minimumScore: 70,
  deadline: inDays(7),
});

describe("assignment creation", () => {
  it("lets a teacher select several outcomes and stores one AssignmentOutcome per outcome", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "5/A", grade: 5 }]);
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");
    const ids = outcomes.slice(0, 3).map((o) => o.id);
    expect(ids).toHaveLength(3);

    const res = await createAssignment(teacher.id, base(rooms[0].id, "Fen Bilimleri", unitOrTheme, ids), db);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.grade).toBe(5);
    expect(res.data.status).toBe("DRAFT");
    expect(res.data.questionCount).toBe(7);

    const links = await db.assignmentOutcome.findMany({ where: { assignmentId: res.data.id } });
    expect(links.map((l) => l.outcomeId).sort()).toEqual([...ids].sort());

    const detail = await getAssignmentForTeacher(teacher.id, res.data.id, db);
    expect(detail!.assignmentOutcomes.map((x) => x.outcome.outcomeCode)).toEqual(outcomes.slice(0, 3).map((o) => o.outcomeCode).sort());
  });

  it("rejects a 6th-grade outcome for a 5th-grade classroom even if the client claims grade 6", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "5/B", grade: 5 }]);
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(6, "Fen Bilimleri");
    const res = await createAssignment(teacher.id, { ...base(rooms[0].id, "Fen Bilimleri", unitOrTheme, [outcomes[0].id]), grade: 6 }, db);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.errors.outcomeIds.join(" ")).toMatch(/6\. sınıfa ait/);
    expect(await db.assignment.count({ where: { classroomId: rooms[0].id } })).toBe(0);
  });

  it("does not let a teacher create an assignment in another teacher's classroom", async () => {
    const owner = await makeTeacher([{ name: "7/A", grade: 7 }]);
    const intruder = await makeTeacher([]);
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(7, "Matematik");
    const res = await createAssignment(intruder.teacher.id, base(owner.rooms[0].id, "Matematik", unitOrTheme, [outcomes[0].id]), db);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(await db.assignment.count({ where: { classroomId: owner.rooms[0].id } })).toBe(0);
  });

  it("always creates a DRAFT – the client cannot create a published assignment directly", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "8/A", grade: 8 }]);
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(8, "Matematik");
    const res = await createAssignment(teacher.id, { ...base(rooms[0].id, "Matematik", unitOrTheme, [outcomes[0].id]), status: "PUBLISHED" }, db);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.status[0]).toMatch(/taslak/);
    const draft = await createAssignment(teacher.id, base(rooms[0].id, "Matematik", unitOrTheme, []), db);
    expect(draft.ok && draft.data.status).toBe("DRAFT");
  });

  it("re-checks every outcome against the DB: status, subject and theme", async () => {
    const { teacher, rooms } = await makeTeacher([{ name: "5/C", grade: 5 }]);
    const fen = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");

    const review = await db.curriculumOutcome.findFirst({ where: { grade: 5, reviewStatus: "REVIEW_REQUIRED" }, include: { units: true } });
    const r1 = await createAssignment(teacher.id, base(rooms[0].id, review!.subject, review!.units[0].unitOrTheme, [review!.id]), db);
    expect(!r1.ok && r1.errors.outcomeIds.join(" ")).toMatch(/VERIFIED/);

    const r2 = await createAssignment(teacher.id, base(rooms[0].id, "Matematik", fen.unitOrTheme, [fen.outcomes[0].id]), db);
    expect(!r2.ok && r2.errors.outcomeIds.join(" ")).toMatch(/dersine ait değil/);

    const otherUnit = await db.curriculumOutcomeUnit.findFirst({ where: { grade: 5, subject: "Fen Bilimleri", NOT: { unitOrTheme: fen.unitOrTheme } } });
    const r3 = await createAssignment(teacher.id, base(rooms[0].id, "Fen Bilimleri", otherUnit!.unitOrTheme, [fen.outcomes[0].id]), db);
    expect(!r3.ok && r3.errors.outcomeIds.join(" ")).toMatch(/tema\/üniteye ait değil/);

    const r4 = await createAssignment(teacher.id, base(rooms[0].id, "Fen Bilimleri", fen.unitOrTheme, ["does-not-exist"]), db);
    expect(!r4.ok && r4.errors.outcomeIds.join(" ")).toMatch(/bulunamadı/);
  });
});

describe("assignment schema", () => {
  const valid = { classroomId: "c", subject: "s", unitOrTheme: "u", topic: "t", outcomeIds: ["a"], minimumScore: 70, deadline: inDays(1) };

  it("accepts a valid payload", () => {
    expect(createAssignmentSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces minimumScore 0–100, a future deadline, question count 5–10 and draft status", () => {
    expect(createAssignmentSchema.safeParse({ ...valid, minimumScore: 101 }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, minimumScore: -1 }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, deadline: inDays(-1) }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, deadline: "not a date" }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, outcomeIds: [] }).success).toBe(true);
    expect(createAssignmentSchema.safeParse({ ...valid, questionCount: 4 }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, questionCount: 11 }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, status: "PUBLISHED" }).success).toBe(false);
    expect(createAssignmentSchema.safeParse({ ...valid, outcomeIds: ["a", "a"] }).success).toBe(false);
  });
});
