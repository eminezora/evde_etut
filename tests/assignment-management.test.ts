import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignment, deleteOrArchiveAssignment, getEditState, listAssignmentsForTeacher, restoreAssignment, updateAssignment } from "../src/lib/assignments/assignment-service.ts";
import { addQuestion, generateStudyContent, getStudentAssignment, listStudentAssignments, saveStudyContent } from "../src/lib/content/content-service.ts";
import { getStudentDetail, listPendingReviews } from "../src/lib/assessment/review-service.ts";
import { getClassroomRoster, getStudentHistory } from "../src/lib/assessment/student-history-service.ts";
import { getStudentDashboard } from "../src/lib/assessment/student-assessment-service.ts";
import { getAssignmentReport } from "../src/lib/analytics/assignment-report.ts";
import { answerState, describeCorrectAnswer } from "../src/lib/assessment/answer-format.ts";
import { ProviderError, type ContentGenerationProvider } from "../src/lib/ai/content-generation-provider.ts";
import { MockContentProvider } from "../src/lib/ai/providers/mock-provider.ts";
import { EvrenContentProvider, extractJson } from "../src/lib/ai/providers/evren-provider.ts";
import { turkeyDeadlineToIso, isoToTurkeyParts } from "../src/lib/assignments/deadline.ts";
import { completeAttempt, correctAnswers, openQuestion, published } from "./assessment-helpers.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

async function draft() {
  const { teacher, rooms } = await makeTeacher([{ name: "7/A", grade: 7 }]);
  const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(7, "Fen Bilimleri");
  const r = await createAssignment(teacher.id, { classroomId: rooms[0].id, subject: "Fen Bilimleri", unitOrTheme, topic: "Taslak", outcomeIds: [outcomes[0].id], minimumScore: 70, deadline: inDays(5) }, db);
  if (!r.ok) throw new Error("draft");
  return { teacher, classroom: rooms[0], id: r.data.id, outcome: outcomes[0] };
}

describe("deadline (Türkiye time)", () => {
  it("round-trips a picked date + time through UTC", () => {
    const iso = turkeyDeadlineToIso("2026-11-02", "09", "30");
    expect(iso).toBe("2026-11-02T06:30:00.000Z");
    expect(isoToTurkeyParts(iso)).toEqual({ date: "2026-11-02", hour: "09", minute: "30" });
  });
});

describe("editing an assignment", () => {
  it("allows every field before students start, and locks the threshold and questions after", async () => {
    const p = await published();
    const newDeadline = inDays(10);
    const before = await updateAssignment(p.teacher.id, p.assignmentId, { topic: "Güneş (yeni)", minimumScore: 60, deadline: newDeadline }, db);
    expect(before.ok).toBe(true);
    // Questions of a published assignment nobody started are still editable.
    expect((await addQuestion(p.teacher.id, p.assignmentId, openQuestion(p.outcome.outcomeCode), db)).ok).toBe(true);

    await completeAttempt(p.student.id, p.assignmentId, correctAnswers(p.questions));
    expect((await getEditState(p.assignmentId, db)).started).toBe(true);
    const statusBefore = (await db.studentAssignment.findFirstOrThrow({ where: { assignmentId: p.assignmentId, studentId: p.student.id } })).status;
    const locked = await updateAssignment(p.teacher.id, p.assignmentId, { topic: "Güneş", minimumScore: 90, deadline: newDeadline }, db);
    expect(!locked.ok && locked.errors.minimumScore?.[0]).toMatch(/başarı eşiği değiştirilemez/);
    const extend = await updateAssignment(p.teacher.id, p.assignmentId, { topic: "Güneş – son", minimumScore: 60, deadline: inDays(14) }, db);
    expect(extend.ok).toBe(true);
    const q = await addQuestion(p.teacher.id, p.assignmentId, openQuestion(p.outcome.outcomeCode), db);
    expect(!q.ok && q.code).toBe("QUESTIONS_LOCKED");
    // The student's result is untouched by the edits.
    const sa = await db.studentAssignment.findFirstOrThrow({ where: { assignmentId: p.assignmentId, studentId: p.student.id } });
    expect(sa.status).toBe(statusBefore);
  });

  it("rejects past deadlines, foreign teachers and question-count changes after publishing", async () => {
    const p = await published();
    expect((await updateAssignment(p.teacher.id, p.assignmentId, { topic: "x", minimumScore: 70, deadline: inDays(-1) }, db)).ok).toBe(false);
    const { teacher: other } = await makeTeacher([]);
    const foreign = await updateAssignment(other.id, p.assignmentId, { topic: "x", minimumScore: 70, deadline: inDays(3) }, db);
    expect(!foreign.ok && foreign.status).toBe(403);
    const qc = await updateAssignment(p.teacher.id, p.assignmentId, { topic: "x", minimumScore: 70, deadline: inDays(3), questionCount: 9 }, db);
    expect(!qc.ok && qc.errors.questionCount).toBeTruthy();
  });
});

describe("deleting / archiving", () => {
  it("hard-deletes an untouched draft", async () => {
    const d = await draft();
    await saveStudyContent(d.teacher.id, d.id, { introduction: "a", keyConcepts: [{ term: "b", explanation: "c" }], summary: "d", simpleExample: "e", mustKnow: ["1", "2", "3"] }, db);
    const r = await deleteOrArchiveAssignment(d.teacher.id, d.id, db);
    expect(r.ok && r.data.action).toBe("DELETED");
    expect(await db.assignment.findUnique({ where: { id: d.id } })).toBeNull();
  });

  it("archives a published assignment with student work and keeps every answer", async () => {
    const p = await published();
    await completeAttempt(p.student.id, p.assignmentId, correctAnswers(p.questions));
    const answersBefore = await db.answer.count({ where: { attempt: { studentAssignment: { assignmentId: p.assignmentId } } } });
    const { teacher: other } = await makeTeacher([]);
    expect((await deleteOrArchiveAssignment(other.id, p.assignmentId, db)).ok).toBe(false);

    const r = await deleteOrArchiveAssignment(p.teacher.id, p.assignmentId, db);
    expect(r.ok && r.data.action).toBe("ARCHIVED");
    expect(await db.answer.count({ where: { attempt: { studentAssignment: { assignmentId: p.assignmentId } } } })).toBe(answersBefore);
    // Hidden from the teacher's default list and from the student, still reportable.
    expect((await listAssignmentsForTeacher(p.teacher.id, db)).some((a) => a.id === p.assignmentId)).toBe(false);
    expect((await listAssignmentsForTeacher(p.teacher.id, db, { archived: true })).some((a) => a.id === p.assignmentId)).toBe(true);
    expect((await getStudentDashboard(p.student.id, db)).some((c) => c.id === p.assignmentId)).toBe(false);
    expect(await getStudentAssignment(p.student.id, p.assignmentId, db)).toBeNull();
    expect((await listStudentAssignments(p.student.id, db)).some((a) => a.id === p.assignmentId)).toBe(false);
    expect(await getStudentDetail(p.teacher.id, p.assignmentId, p.student.id, db)).not.toBeNull();

    expect((await restoreAssignment(p.teacher.id, p.assignmentId, db)).ok).toBe(true);
    expect((await getStudentDashboard(p.student.id, db)).some((c) => c.id === p.assignmentId)).toBe(true);
  });

  it("archives (not deletes) a draft that students already opened", async () => {
    const p = await published();
    await db.studentAssignment.create({ data: { assignmentId: p.assignmentId, studentId: p.student.id, status: "READING" } }).catch(() => undefined);
    await db.assignment.update({ where: { id: p.assignmentId }, data: { status: "DRAFT" } });
    const r = await deleteOrArchiveAssignment(p.teacher.id, p.assignmentId, db);
    expect(r.ok && r.data.action).toBe("ARCHIVED");
  });
});

describe("teacher reports and answer sheets", () => {
  it("shows every answer with the correct answer, points and state", async () => {
    const p = await published({ withOpen: true });
    const answers = correctAnswers(p.questions);
    // Wrong multiple-choice answer.
    const mc = p.questions.find((q) => q.type === "MULTIPLE_CHOICE")!;
    answers[p.questions.indexOf(mc)] = { questionId: mc.id, answer: { selectedIndex: 0 } };
    await completeAttempt(p.student.id, p.assignmentId, answers);
    const d = await getStudentDetail(p.teacher.id, p.assignmentId, p.student.id, db);
    const sheet = d!.sa!.attempts[0].answers;
    expect(sheet).toHaveLength(p.questions.length);
    const mcRow = sheet.find((x) => x.question.type === "MULTIPLE_CHOICE")!;
    expect(answerState(mcRow, mcRow.question.points)).toBe("INCORRECT");
    expect(describeCorrectAnswer("MULTIPLE_CHOICE", mcRow.question.data).text).toBe("Yıldız");
    const tf = sheet.find((x) => x.question.type === "TRUE_FALSE")!;
    expect(answerState(tf, tf.question.points)).toBe("CORRECT");
    const open = sheet.find((x) => x.question.type === "SHORT_ANSWER")!;
    expect(answerState(open, open.question.points)).toBe("PENDING");
    expect(describeCorrectAnswer("SHORT_ANSWER", open.question.data).text).toContain("yıldız");
    // Only the open answer waits in the teacher's queue.
    const queue = (await listPendingReviews(p.teacher.id, db)).filter((x) => x.assignment.id === p.assignmentId);
    expect(queue.map((x) => x.question.type)).toEqual(["SHORT_ANSWER"]);
  });

  it("finishes automatically when there is no open-ended question", async () => {
    const p = await published();
    const r = await completeAttempt(p.student.id, p.assignmentId, correctAnswers(p.questions));
    expect(r.status).not.toBe("PENDING_TEACHER_REVIEW");
    expect((await listPendingReviews(p.teacher.id, db)).filter((x) => x.assignment.id === p.assignmentId)).toHaveLength(0);
    const report = await getAssignmentReport(p.teacher.id, p.assignmentId, db);
    const row = report!.students.find((s) => s.studentId === p.student.id)!;
    expect(row).toMatchObject({ status: "READY", attemptCount: 1, latestPoints: { earned: 50, total: 50 } });
    expect(row.startedAt).not.toBeNull();
  });

  it("never shows another teacher's students, answers or history", async () => {
    const p = await published();
    await completeAttempt(p.student.id, p.assignmentId, correctAnswers(p.questions));
    const { teacher: other, rooms } = await makeTeacher([{ name: "5/B", grade: 5 }]);
    expect(await getStudentDetail(other.id, p.assignmentId, p.student.id, db)).toBeNull();
    expect(await getAssignmentReport(other.id, p.assignmentId, db)).toBeNull();
    expect(await getStudentHistory(other.id, p.student.id, db)).toBeNull();
    expect(await getClassroomRoster(other.id, p.classroom.id, db)).toBeNull();
    // A student of the other teacher can't be looked up through this assignment either.
    const outsider = await makeStudent([rooms[0].id]);
    expect(await getStudentDetail(p.teacher.id, p.assignmentId, outsider.id, db)).toBeNull();
    expect(await getStudentHistory(p.teacher.id, outsider.id, db)).toBeNull();
  });

  it("builds the student history from the teacher's own assignments", async () => {
    const p = await published();
    await completeAttempt(p.student.id, p.assignmentId, correctAnswers(p.questions));
    const h = await getStudentHistory(p.teacher.id, p.student.id, db);
    expect(h!.stats).toMatchObject({ total: 1, completed: 1, ready: 1, needsReview: 0, averageScore: 100 });
    expect(h!.recent[0].id).toBe(p.assignmentId);
    const roster = await getClassroomRoster(p.teacher.id, p.classroom.id, db);
    expect(roster!.roster.find((s) => s.id === p.student.id)).toMatchObject({ ready: 1, average: 100 });
  });
});

describe("AI generation robustness", () => {
  it("accepts fences, a short preface and trailing commas, but rejects broken JSON", () => {
    expect(extractJson('Tabii, işte JSON:\n```json\n{"a": [1, 2,], "b": {"c": 3,},}\n```')).toEqual({ a: [1, 2], b: { c: 3 } });
    expect(() => extractJson('{"a": [1, 2}')).toThrow(ProviderError);
    expect(() => extractJson("JSON yok")).toThrow(ProviderError);
  });

  it("retries a 429/5xx or network error exactly once", async () => {
    const body = { choices: [{ message: { content: '{"introduction":"x"}' }, finish_reason: "stop" }] };
    let calls = 0;
    const flaky = (async () => {
      calls++;
      return calls === 1 ? new Response("{}", { status: 503 }) : new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new EvrenContentProvider({ baseUrl: "https://llm.test/v1", apiKey: "k", model: "m", fetchImpl: flaky });
    const input = { scope: "SUMMARY" as const, subject: "Fen", grade: 6, unitOrTheme: "u", teacherTopic: "t", questionCount: 5, outcomes: [] };
    expect((await p.generatePreparationContent(input, { signal: AbortSignal.timeout(10_000) })).raw).toEqual({ introduction: "x" });
    expect(calls).toBe(2);

    let netCalls = 0;
    const down = (async () => {
      netCalls++;
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const p2 = new EvrenContentProvider({ baseUrl: "https://llm.test/v1", apiKey: "k", model: "m", fetchImpl: down });
    await expect(p2.generatePreparationContent(input, { signal: AbortSignal.timeout(10_000) })).rejects.toMatchObject({ kind: "FAILED" });
    expect(netCalls).toBe(2); // one retry, never more

    let badCalls = 0;
    const always500 = (async () => {
      badCalls++;
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;
    const p3 = new EvrenContentProvider({ baseUrl: "https://llm.test/v1", apiKey: "k", model: "m", fetchImpl: always500 });
    await expect(p3.generatePreparationContent(input, { signal: AbortSignal.timeout(10_000) })).rejects.toMatchObject({ kind: "FAILED" });
    expect(badCalls).toBe(2);
  });

  it("retries an invalid AI answer once and then saves the valid draft", async () => {
    const d = await draft();
    const mock = new MockContentProvider();
    let calls = 0;
    const flaky: ContentGenerationProvider = {
      name: "flaky",
      model: "m",
      async generatePreparationContent(input) {
        calls++;
        if (calls === 1) return { raw: { introduction: 1 } };
        return mock.generatePreparationContent(input);
      },
    };
    const r = await generateStudyContent(d.teacher.id, d.id, { scope: "ALL", questionCount: 5 }, { db, provider: flaky });
    expect(r.ok).toBe(true);
    expect(calls).toBe(4); // 2 attempts × (content + questions in parallel)
    expect(await db.question.count({ where: { assignmentId: d.id } })).toBe(5);
  });

  it("requests content and questions in parallel for ALL and merges them", async () => {
    const d = await draft();
    const mock = new MockContentProvider();
    const scopes: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const tracking: ContentGenerationProvider = {
      name: "tracking",
      model: "m",
      async generatePreparationContent(input) {
        scopes.push(input.scope);
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight--;
        return mock.generatePreparationContent(input);
      },
    };
    const r = await generateStudyContent(d.teacher.id, d.id, { scope: "ALL", questionCount: 6 }, { db, provider: tracking });
    expect(r.ok).toBe(true);
    expect(scopes.sort()).toEqual(["QUESTIONS", "SUMMARY"]);
    expect(maxInFlight).toBe(2);
    expect(await db.question.count({ where: { assignmentId: d.id } })).toBe(6);
    expect(await db.studyContent.count({ where: { assignmentId: d.id } })).toBe(1);
  });

  it("gives up after one retry and records the failure", async () => {
    const d = await draft();
    let calls = 0;
    const broken: ContentGenerationProvider = {
      name: "broken",
      model: "m",
      async generatePreparationContent() {
        calls++;
        throw new ProviderError("INCOMPLETE", "bozuk");
      },
    };
    const r = await generateStudyContent(d.teacher.id, d.id, {}, { db, provider: broken });
    expect(!r.ok && r.code).toBe("INVALID_RESPONSE");
    expect(calls).toBe(4); // one retry only: 2 attempts × 2 parallel calls
    expect((await db.contentGenerationLog.findFirst({ where: { assignmentId: d.id }, orderBy: { startedAt: "desc" } }))!.status).toBe("INVALID_RESPONSE");
  });
});
