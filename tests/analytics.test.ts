import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAssignmentReport, lessonRecommendation, reportToCsv } from "../src/lib/analytics/assignment-report.ts";
import { listPendingReviews, reviewAnswer } from "../src/lib/assessment/review-service.ts";
import { completeAttempt, correctAnswers, published } from "./assessment-helpers.ts";
import { db, ensureCurriculum, makeStudent, makeTeacher } from "./helpers.ts";

// The CSV route reads the session through current-user; tests decide who is "logged in".
const session = vi.hoisted(() => ({ teacher: null as null | { id: string; name: string; email: string } }));
vi.mock("../src/lib/auth/current-user.ts", () => ({ getCurrentTeacher: async () => session.teacher }));
const { GET: exportCsv } = await import("../src/app/api/assignments/[id]/report/route.ts");
const callExport = (id: string) => exportCsv(new Request(`http://test/api/assignments/${id}/report`), { params: Promise.resolve({ id }) });

beforeAll(ensureCurriculum);
beforeEach(() => {
  session.teacher = null;
});
afterAll(() => db.$disconnect());

/**
 * Class of 4 on an assignment with 5 objective questions (10 pts each) + 1 open question (50 pts):
 *  s1: all correct, open answer graded 50/50          → READY_FOR_CLASS, 100
 *  s2: only the true/false question, open left blank → NEEDS_REVIEW, 10
 *  s3: all correct, open answer not yet graded        → PENDING_TEACHER_REVIEW (auto part 100)
 *  s4: never opened the assignment                    → NOT_STARTED
 */
async function scenario() {
  const base = await published({ withOpen: true });
  const { teacher, classroom, assignmentId, questions } = base;
  const s1 = base.student;
  const s2 = await makeStudent([classroom.id]);
  const s3 = await makeStudent([classroom.id]);
  await makeStudent([classroom.id]);
  const all = correctAnswers(questions);
  const tfOnly = all.filter((x) => questions.find((q) => q.id === x.questionId)!.type === "TRUE_FALSE");

  await completeAttempt(s1.id, assignmentId, all);
  const [p1] = await listPendingReviews(teacher.id, db);
  const graded = await reviewAnswer(teacher.id, p1.answerId, { awardedPoints: 50 }, db);
  if (!graded.ok) throw new Error("review failed");
  await completeAttempt(s2.id, assignmentId, tfOnly);
  await completeAttempt(s3.id, assignmentId, all);
  return { ...base, s1, s2, s3 };
}

describe("assignment analytics", () => {
  it("computes counts, both readiness rates and averages from real data", async () => {
    const { teacher, assignmentId } = await scenario();
    const r = await getAssignmentReport(teacher.id, assignmentId, db);
    expect(r).not.toBeNull();
    expect(r!.totals).toMatchObject({
      assigned: 4,
      started: 3,
      summaryConfirmed: 3,
      assessmentStarted: 3,
      completed: 2,
      ready: 1,
      needsReview: 1,
      pending: 1,
      notStarted: 1,
      notCompleted: 1,
      readinessRate: 25, // 1 ready / 4 assigned
      readinessAmongCompleted: 50, // 1 ready / 2 completed
      averageAttempts: 1,
    });
    // PENDING_TEACHER_REVIEW (auto part 100) must not enter the average: (100 + 10) / 2.
    expect(r!.totals.averageLatestScore).toBe(55);
    expect(r!.totals.averageBestScore).toBe(55);
    expect(r!.scoreDistribution.find((b) => b.label === "80–100")!.count).toBe(1);
    expect(r!.scoreDistribution.find((b) => b.label === "0–19")!.count).toBe(1);
    expect(r!.statusDistribution.map((s) => s.count).reduce((a, b) => a + b)).toBe(4);
  });

  it("computes question correct rates and outcome success over each student's latest attempt", async () => {
    const { teacher, assignmentId, outcome } = await scenario();
    const r = (await getAssignmentReport(teacher.id, assignmentId, db))!;
    const byType = Object.fromEntries(r.questionStats.map((q) => [q.type, q]));
    // MC: s1 ✓, s2 blank ✗, s3 ✓
    expect(byType.MULTIPLE_CHOICE).toMatchObject({ answered: 3, correct: 2, incorrect: 1, correctRate: 67, averagePoints: 6.7 });
    expect(byType.TRUE_FALSE).toMatchObject({ answered: 3, correct: 3, correctRate: 100 });
    // Open question: s1 graded 50 ✓, s2 blank ✗, s3 pending → excluded.
    expect(byType.SHORT_ANSWER).toMatchObject({ answered: 2, correct: 1, correctRate: 50, averagePoints: 25 });
    expect(r.hardestQuestions[0].type).toBe("SHORT_ANSWER");
    expect(r.briefing.hardestQuestion!.number).toBe(6);

    // Outcome: earned 100 (s1) + 10 (s2) + 50 (s3, auto part) of 100 + 100 + 50 possible = 160 / 250.
    const o = r.outcomeStats.find((x) => x.code === outcome.outcomeCode)!;
    expect(o).toMatchObject({ questionCount: 6, successRate: 64 });
    expect(r.weakestOutcomes.map((x) => x.code)).toEqual([outcome.outcomeCode]);
    expect(r.recommendation!.text).toMatch(/hazır bulunuşluğu düşük/);
    expect(r.recommendation!.focus).toContain(outcome.outcomeCode);
  });

  it("shows an empty state when no student has finished", async () => {
    const { teacher, assignmentId } = await published();
    const r = (await getAssignmentReport(teacher.id, assignmentId, db))!;
    expect(r.hasData).toBe(false);
    expect(r.recommendation).toBeNull();
    expect(r.totals).toMatchObject({ assigned: 1, completed: 0, readinessRate: 0, readinessAmongCompleted: null, averageLatestScore: null });
    expect(r.questionStats.every((q) => q.correctRate === null)).toBe(true);
    expect(r.hardestQuestions).toEqual([]);
    expect(r.trend).toEqual([]);
  });

  it("shows the readiness trend only when the class has earlier assignments in the subject", async () => {
    const first = await scenario();
    expect((await getAssignmentReport(first.teacher.id, first.assignmentId, db))!.trend).toEqual([]);
    // A second published assignment in the same classroom + subject.
    const second = await db.assignment.create({
      data: { teacherId: first.teacher.id, classroomId: first.classroom.id, subject: "Fen Bilimleri", grade: 5, unitOrTheme: "x", topic: "İkinci", deadline: new Date(Date.now() + 86_400_000), status: "PUBLISHED", publishedAt: new Date() },
    });
    const trend = (await getAssignmentReport(first.teacher.id, second.id, db))!.trend;
    expect(trend.map((p) => p.readinessRate)).toEqual([25, 0]);
  });
});

describe("authorization", () => {
  it("only the owner teacher gets the report; other teachers and students get nothing", async () => {
    const { teacher, student, assignmentId } = await published();
    expect(await getAssignmentReport(teacher.id, assignmentId, db)).not.toBeNull();
    const other = await makeTeacher([]);
    expect(await getAssignmentReport(other.teacher.id, assignmentId, db)).toBeNull();
    expect(await getAssignmentReport(student.id, assignmentId, db)).toBeNull();
  });

  it("CSV export: 401 without a teacher session (students too), 404 for another teacher, CSV for the owner", async () => {
    const { teacher, assignmentId } = await scenario();
    expect((await callExport(assignmentId)).status).toBe(401); // no session / student session

    const other = await makeTeacher([]);
    session.teacher = { id: other.teacher.id, name: "x", email: "x" };
    expect((await callExport(assignmentId)).status).toBe(404);

    session.teacher = { id: teacher.id, name: "t", email: "t" };
    const res = await callExport(assignmentId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Öğrenci,Durum,Deneme sayısı,Son puan,En iyi puan,Özeti onayladı,Tamamlanma zamanı");
    expect(lines).toHaveLength(5);
    expect(csv).not.toMatch(/@|passwordHash|okul\.test/);
  });

  it("CSV cells are escaped against formula injection", async () => {
    const { teacher, assignmentId, student } = await published();
    await db.user.update({ where: { id: student.id }, data: { name: '=HYPERLINK("x","y")' } });
    const csv = reportToCsv((await getAssignmentReport(teacher.id, assignmentId, db))!);
    expect(csv).toContain(`"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe("lesson recommendation", () => {
  const weak = { code: "MAT.5.1.1", text: "Sayıları okuma", successRate: 55 };
  it("follows the thresholds", () => {
    expect(lessonRecommendation(80, null)!.text).toMatch(/genel olarak derse hazır/);
    expect(lessonRecommendation(79, null)!.text).toMatch(/önemli bir bölümü hazır/);
    expect(lessonRecommendation(60, null)!.level).toBe("medium");
    expect(lessonRecommendation(59, null)!.text).toMatch(/hazır bulunuşluğu düşük/);
    expect(lessonRecommendation(null, weak)).toBeNull();
  });
  it("adds the weakest outcome only when it is actually weak", () => {
    expect(lessonRecommendation(90, weak)!.focus).toContain("MAT.5.1.1");
    expect(lessonRecommendation(90, { ...weak, successRate: 85 })!.focus).toBeNull();
  });
});
