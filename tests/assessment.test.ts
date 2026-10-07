import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { correctAnswers, published, readAndConfirm } from "./assessment-helpers.ts";
import {
  MESSAGES,
  confirmSummary,
  getAssessmentView,
  getOwnAttempt,
  getResultView,
  getStudentDashboard,
  openSummary,
  saveAnswers,
  startAttempt,
  submitAttempt,
} from "../src/lib/assessment/student-assessment-service.ts";
import { listPendingReviews, reviewAnswer, updateAssessmentPolicy } from "../src/lib/assessment/review-service.ts";
import {
  normalizeText,
  scoreFillBlank,
  scoreMatching,
  scoreMultipleChoice,
  scoreOrdering,
  scoreQuestion,
  scoreTrueFalse,
} from "../src/lib/assessment/scoring-service.ts";
import { canTransition } from "../src/lib/assessment/status-machine.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

const sa = (assignmentId: string, studentId: string) => db.studentAssignment.findUniqueOrThrow({ where: { assignmentId_studentId: { assignmentId, studentId } } });

describe("scoring engine", () => {
  it("scores multiple choice, true/false and fill-in-the-blank", () => {
    const mc = { options: ["a", "b"], correctAnswer: "b" };
    expect(scoreMultipleChoice(mc, { selectedIndex: 1 })).toBe(true);
    expect(scoreMultipleChoice(mc, { selectedIndex: 0 })).toBe(false);
    expect(scoreTrueFalse({ correctAnswer: false }, { value: false })).toBe(true);
    expect(scoreTrueFalse({ correctAnswer: false }, { value: true })).toBe(false);
    expect(scoreFillBlank({ correctAnswer: "Işık" }, { text: "  ışık " })).toBe(true); // tr-TR lower-case of I → ı
    expect(scoreFillBlank({ correctAnswer: "İnsan" }, { text: "insan" })).toBe(true);
    expect(scoreFillBlank({ correctAnswer: "Işık" }, { text: "isik" })).toBe(false); // no silent de-accenting
    expect(scoreFillBlank({ correctAnswer: "yıldız", acceptableAnswers: ["star"] }, { text: "Star" })).toBe(true);
    expect(normalizeText("  Çok   Güzel ")).toBe("çok güzel");
  });

  it("scores matching and ordering with partial credit", () => {
    const pairs = { pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }] };
    expect(scoreMatching(pairs, { matches: ["1", "2"] })).toBe(1);
    expect(scoreMatching(pairs, { matches: ["1", "1"] })).toBe(0.5);
    const ord = { items: ["x", "y", "z"], correctOrder: [2, 0, 1] };
    expect(scoreOrdering(ord, { order: [2, 0, 1] })).toBe(1);
    expect(scoreOrdering(ord, { order: [0, 1, 2] })).toBe(0);
    expect(scoreQuestion({ id: "q", type: "ORDERING", points: 9, data: ord }, { order: [2, 1, 0] })).toMatchObject({ isCorrect: false, awardedPoints: 3 });
    expect(scoreQuestion({ id: "q", type: "LONG_ANSWER", points: 9, data: {} }, { text: "cevap" }).reviewStatus).toBe("PENDING_REVIEW");
    expect(scoreQuestion({ id: "q", type: "LONG_ANSWER", points: 9, data: {} }, { text: "  " })).toMatchObject({ reviewStatus: "UNANSWERED", awardedPoints: 0 });
  });

  it("only allows server-defined status transitions", () => {
    expect(canTransition("NOT_STARTED", "READY_FOR_CLASS")).toBe(false);
    expect(canTransition("READING", "ASSESSMENT_IN_PROGRESS")).toBe(false);
    expect(canTransition("ASSESSMENT_IN_PROGRESS", "PENDING_TEACHER_REVIEW")).toBe(true);
    expect(canTransition("READY_FOR_CLASS", "ASSESSMENT_IN_PROGRESS")).toBe(false);
  });
});

describe("student flow", () => {
  it("shows the published assignment on the dashboard and moves to READING on first summary open", async () => {
    const { student, assignmentId } = await published();
    const cards = await getStudentDashboard(student.id, db);
    expect(cards.find((c) => c.id === assignmentId)).toMatchObject({ category: "UPCOMING", status: "NOT_STARTED", teacher: expect.any(String) });

    await openSummary(student.id, assignmentId, db);
    const first = await sa(assignmentId, student.id);
    expect(first.status).toBe("READING");
    expect(first.summaryOpenedAt).not.toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    await openSummary(student.id, assignmentId, db);
    expect((await sa(assignmentId, student.id)).summaryOpenedAt).toEqual(first.summaryOpenedAt); // not overwritten
    expect(await db.studentAssignment.count({ where: { assignmentId, studentId: student.id } })).toBe(1);
  });

  it("requires the server-side confirmation before an attempt can start", async () => {
    const { student, assignmentId } = await published();
    await openSummary(student.id, assignmentId, db);
    const early = await startAttempt(student.id, assignmentId, db);
    expect(!early.ok && early.message).toBe(MESSAGES.confirmFirst);
    expect((await confirmSummary(student.id, assignmentId, { confirmed: false }, db)).ok).toBe(false);

    const ok = await confirmSummary(student.id, assignmentId, { confirmed: true }, db);
    expect(ok.ok && ok.data.status).toBe("READY_FOR_ASSESSMENT");
    expect((await sa(assignmentId, student.id)).summaryConfirmedAt).not.toBeNull();
    const started = await startAttempt(student.id, assignmentId, db);
    expect(started.ok && started.data.attemptNumber).toBe(1);
    expect((await sa(assignmentId, student.id)).status).toBe("ASSESSMENT_IN_PROGRESS");
    // A second start (double click) resumes the same attempt.
    const again = await startAttempt(student.id, assignmentId, db);
    expect(again.ok && again.data.id).toBe(started.ok && started.data.id);
  });

  it("scores a full objective attempt on the server → READY_FOR_CLASS", async () => {
    const { student, assignmentId, questions } = await published();
    await readAndConfirm(student.id, assignmentId);
    const attempt = await startAttempt(student.id, assignmentId, db);
    if (!attempt.ok) throw new Error(attempt.message);
    const saved = await saveAnswers(student.id, attempt.data.id, { answers: correctAnswers(questions).slice(0, 2) }, db);
    expect(saved.ok).toBe(true);
    const res = await submitAttempt(student.id, attempt.data.id, { answers: correctAnswers(questions).slice(2) }, db);
    expect(res.ok && res.data).toMatchObject({ status: "READY_FOR_CLASS", finalScore: 100 });
    const row = await sa(assignmentId, student.id);
    expect(row).toMatchObject({ status: "READY_FOR_CLASS", latestScore: 100, bestScore: 100 });
    expect(row.completedAt).not.toBeNull();
    const att = await db.attempt.findUniqueOrThrow({ where: { id: attempt.data.id } });
    expect(att).toMatchObject({ status: "COMPLETED", finalScore: 100, correctCount: 5, incorrectCount: 0 });

    // Submitted attempts are frozen; a second submit is rejected.
    expect((await submitAttempt(student.id, attempt.data.id, {}, db)).ok).toBe(false);
    expect((await saveAnswers(student.id, attempt.data.id, { answers: correctAnswers(questions).slice(0, 1) }, db)).ok).toBe(false);
    // READY_FOR_CLASS: no further attempts by default.
    const more = await startAttempt(student.id, assignmentId, db);
    expect(!more.ok && more.message).toBe(MESSAGES.alreadyReady);
  });

  it("below the threshold → NEEDS_REVIEW with revision suggestions; retry keeps old attempts", async () => {
    const { student, assignmentId, questions, outcome } = await published();
    await readAndConfirm(student.id, assignmentId);
    const a1 = await startAttempt(student.id, assignmentId, db);
    if (!a1.ok) throw new Error(a1.message);
    // Only the true/false question right → 10 / 50 = 20.
    const tf = correctAnswers(questions).filter((x) => questions.find((q) => q.id === x.questionId)!.type === "TRUE_FALSE");
    const r1 = await submitAttempt(student.id, a1.data.id, { answers: tf }, db);
    expect(r1.ok && r1.data).toMatchObject({ status: "NEEDS_REVIEW", finalScore: 20 });
    expect(await sa(assignmentId, student.id)).toMatchObject({ status: "NEEDS_REVIEW", latestScore: 20 });

    const result = await getResultView(student.id, assignmentId, db);
    expect(result!.recommendations!.outcomes.map((o) => o.code)).toEqual([outcome.outcomeCode]);
    expect(result!.recommendations!.concepts.map((k) => k.term)).toContain("Güneş");
    // Default policy hides per-question correctness/answers before passing.
    expect(result!.attempt!.questions.every((q) => q.isCorrect === null && q.correctAnswer === null)).toBe(true);

    const a2 = await startAttempt(student.id, assignmentId, db);
    expect(a2.ok && a2.data.attemptNumber).toBe(2);
    if (!a2.ok) return;
    const r2 = await submitAttempt(student.id, a2.data.id, { answers: correctAnswers(questions) }, db);
    expect(r2.ok && r2.data.status).toBe("READY_FOR_CLASS");
    const attempts = await db.attempt.findMany({ where: { studentAssignment: { assignmentId, studentId: student.id } }, orderBy: { attemptNumber: "asc" } });
    expect(attempts.map((x) => [x.attemptNumber, x.finalScore])).toEqual([[1, 20], [2, 100]]);
    expect(await sa(assignmentId, student.id)).toMatchObject({ latestScore: 100, bestScore: 100, attemptCount: 2 });
  });

  it("sends open answers to the teacher and finalizes after review", async () => {
    const { teacher, student, assignmentId, questions } = await published({ withOpen: true });
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    const r = await submitAttempt(student.id, att.data.id, { answers: correctAnswers(questions) }, db);
    expect(r.ok && r.data).toMatchObject({ status: "PENDING_TEACHER_REVIEW", finalScore: null });
    expect(await sa(assignmentId, student.id)).toMatchObject({ status: "PENDING_TEACHER_REVIEW", latestScore: null });
    expect(await db.attempt.findUniqueOrThrow({ where: { id: att.data.id } })).toMatchObject({ requiresTeacherReview: true, finalScore: null, autoScore: 100 });
    const view = await getResultView(student.id, assignmentId, db);
    expect(view!.attempt).toMatchObject({ pending: true, finalScore: null });
    expect((await startAttempt(student.id, assignmentId, db)).ok).toBe(false);

    const pending = await listPendingReviews(teacher.id, db);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ maxPoints: 50, answerText: "Işık veren bir yıldızdır." });
    expect((await reviewAnswer(teacher.id, pending[0].answerId, { awardedPoints: 51 }, db)).ok).toBe(false);
    expect((await reviewAnswer(teacher.id, pending[0].answerId, { awardedPoints: -1 }, db)).ok).toBe(false);

    // 50 objective + 10/50 open = 60/100 < 70 → NEEDS_REVIEW
    const done = await reviewAnswer(teacher.id, pending[0].answerId, { awardedPoints: 10, feedback: "Daha ayrıntılı yaz." }, db);
    expect(done.ok && done.data.result).toMatchObject({ status: "NEEDS_REVIEW", finalScore: 60 });
    expect(await db.attempt.findUniqueOrThrow({ where: { id: att.data.id } })).toMatchObject({ finalScore: 60, manualScore: 20, autoScore: 100, status: "COMPLETED" });
    expect(await sa(assignmentId, student.id)).toMatchObject({ status: "NEEDS_REVIEW", latestScore: 60 });
    const result = await getResultView(student.id, assignmentId, db);
    expect(result!.attempt!.questions.find((q) => q.type === "SHORT_ANSWER")!.teacherFeedback).toBe("Daha ayrıntılı yaz.");
  });

  it("teacher review pushing the score over the threshold → READY_FOR_CLASS", async () => {
    const { teacher, student, assignmentId, questions } = await published({ withOpen: true });
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    await submitAttempt(student.id, att.data.id, { answers: correctAnswers(questions) }, db);
    const [p] = await listPendingReviews(teacher.id, db);
    const done = await reviewAnswer(teacher.id, p.answerId, { awardedPoints: 40 }, db);
    expect(done.ok && done.data.result).toMatchObject({ status: "READY_FOR_CLASS", finalScore: 90 });
  });

  it("enforces the attempt limit and lets the teacher change it", async () => {
    const { teacher, student, assignmentId } = await published({ maxAttempts: 1 });
    await readAndConfirm(student.id, assignmentId);
    const a1 = await startAttempt(student.id, assignmentId, db);
    if (!a1.ok) throw new Error(a1.message);
    await submitAttempt(student.id, a1.data.id, {}, db); // all unanswered → 0 → NEEDS_REVIEW
    const blocked = await startAttempt(student.id, assignmentId, db);
    expect(!blocked.ok && blocked.message).toBe("Bu görev için izin verilen deneme sayısını tamamladın.");
    expect(await db.attempt.count({ where: { studentAssignment: { assignmentId } } })).toBe(1);

    const upd = await updateAssessmentPolicy(teacher.id, assignmentId, { maxAttempts: 2, unlimitedAttempts: false, showExplanationsAfterSubmit: false, showAnswersAfterPass: true }, db);
    expect(upd.ok).toBe(true);
    expect((await startAttempt(student.id, assignmentId, db)).ok).toBe(true);
  });

  it("expires after the deadline: no new attempt, no late submit, old attempts kept", async () => {
    const { student, assignmentId, questions } = await published();
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    await saveAnswers(student.id, att.data.id, { answers: correctAnswers(questions).slice(0, 1) }, db);
    await db.assignment.update({ where: { id: assignmentId }, data: { deadline: new Date(Date.now() - 1000) } });

    const late = await submitAttempt(student.id, att.data.id, {}, db);
    expect(!late.ok && late.code).toBe("DEADLINE");
    const fresh = await startAttempt(student.id, assignmentId, db);
    expect(!fresh.ok && fresh.code).toBe("DEADLINE");
    expect(await sa(assignmentId, student.id)).toMatchObject({ status: "EXPIRED" });
    const kept = await db.attempt.findUniqueOrThrow({ where: { id: att.data.id }, include: { answers: true } });
    expect(kept.status).toBe("EXPIRED");
    expect(kept.answers).toHaveLength(1);
    expect((await getStudentDashboard(student.id, db)).find((c) => c.id === assignmentId)!.category).toBe("EXPIRED");
  });
});

describe("security", () => {
  it("students cannot read or write another student's attempt", async () => {
    const { student, classroom, assignmentId, questions } = await published();
    const other = await makeStudent([classroom.id]);
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);

    expect(await getOwnAttempt(other.id, att.data.id, db)).toBeNull();
    expect((await saveAnswers(other.id, att.data.id, { answers: correctAnswers(questions).slice(0, 1) }, db)).ok).toBe(false);
    expect((await submitAttempt(other.id, att.data.id, { answers: correctAnswers(questions) }, db)).ok).toBe(false);
    expect(await db.answer.count({ where: { attemptId: att.data.id } })).toBe(0);
    expect((await db.attempt.findUniqueOrThrow({ where: { id: att.data.id } })).status).toBe("IN_PROGRESS");
  });

  it("never exposes correct answers to the student before the policy allows it", async () => {
    const { student, assignmentId } = await published();
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    const view = await getAssessmentView(student.id, assignmentId, db);
    const own = await getOwnAttempt(student.id, att.data.id, db);
    const blob = JSON.stringify([view, own]);
    for (const secret of ["correctAnswer", "correctOrder", "acceptableAnswers", "sampleAnswer", "explanation", "\"pairs\""]) expect(blob).not.toContain(secret);
  });

  it("ignores client-sent scores and statuses", async () => {
    const { student, assignmentId, questions } = await published();
    await openSummary(student.id, assignmentId, db);
    // There is no API that accepts a status; confirm only accepts { confirmed: true }.
    await confirmSummary(student.id, assignmentId, { confirmed: true, status: "READY_FOR_CLASS", finalScore: 100 }, db);
    expect((await sa(assignmentId, student.id)).status).toBe("READY_FOR_ASSESSMENT");
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    const res = await submitAttempt(student.id, att.data.id, { answers: [], finalScore: 100, status: "READY_FOR_CLASS", attemptNumber: 9 }, db);
    expect(res.ok && res.data).toMatchObject({ status: "NEEDS_REVIEW", finalScore: 0 });
    // Injected answer fields are not trusted either.
    const a2 = await startAttempt(student.id, assignmentId, db);
    if (!a2.ok) throw new Error(a2.message);
    expect(a2.data.attemptNumber).toBe(2);
    const forged = await saveAnswers(student.id, a2.data.id, { answers: [{ questionId: questions[0].id, answer: { selectedIndex: 0, isCorrect: true, awardedPoints: 10 } }] }, db);
    expect(forged.ok).toBe(true);
    const stored = await db.answer.findFirstOrThrow({ where: { attemptId: a2.data.id } });
    expect(stored.answer).toEqual({ selectedIndex: 0 });
    expect(stored.awardedPoints).toBeNull();
  });

  it("blocks drafts, other classrooms and foreign questions", async () => {
    const { student, assignmentId } = await published();
    const outsider = await makeStudent([]);
    expect((await openSummary(outsider.id, assignmentId, db)).ok).toBe(false);
    expect((await startAttempt(outsider.id, assignmentId, db)).ok).toBe(false);
    expect((await getStudentDashboard(outsider.id, db)).map((c) => c.id)).not.toContain(assignmentId);

    // A draft in the student's own classroom.
    const classroomId = (await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } })).classroomId;
    const teacherId = (await db.classroom.findUniqueOrThrow({ where: { id: classroomId } })).teacherId;
    const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");
    const draft = await createAssignment(teacherId, { classroomId, subject: "Fen Bilimleri", unitOrTheme, topic: "Taslak", outcomeIds: [outcomes[0].id], minimumScore: 70, deadline: inDays(3) }, db);
    if (!draft.ok) throw new Error("setup");
    expect((await openSummary(student.id, draft.data.id, db)).ok).toBe(false);
    expect(await getResultView(student.id, draft.data.id, db)).toBeNull();
    expect((await getStudentDashboard(student.id, db)).map((c) => c.id)).not.toContain(draft.data.id);

    // A question of another assignment cannot be answered in this attempt.
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    const foreign = await published();
    const res = await saveAnswers(student.id, att.data.id, { answers: [{ questionId: foreign.questions[0].id, answer: { selectedIndex: 0 } }] }, db);
    expect(!res.ok && res.code).toBe("FOREIGN_QUESTION");
    const dup = await saveAnswers(student.id, att.data.id, { answers: [{ questionId: foreign.questions[0].id, answer: {} }, { questionId: foreign.questions[0].id, answer: {} }] }, db);
    expect(dup.ok).toBe(false);
  });

  it("teachers can only review answers of their own assignments", async () => {
    const { student, assignmentId, questions } = await published({ withOpen: true });
    await readAndConfirm(student.id, assignmentId);
    const att = await startAttempt(student.id, assignmentId, db);
    if (!att.ok) throw new Error(att.message);
    await submitAttempt(student.id, att.data.id, { answers: correctAnswers(questions) }, db);
    const answer = await db.answer.findFirstOrThrow({ where: { attemptId: att.data.id, reviewStatus: "PENDING_REVIEW" } });
    const other = await makeTeacher([]);
    expect((await reviewAnswer(other.teacher.id, answer.id, { awardedPoints: 50 }, db)).ok).toBe(false);
    expect(await listPendingReviews(other.teacher.id, db)).toEqual([]);
  });
});
