import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { AI_NOT_CONFIGURED_MESSAGE, getContentProvider } from "../src/lib/ai/index.ts";
import { ProviderError, type ContentGenerationProvider, type PreparationContentInput } from "../src/lib/ai/content-generation-provider.ts";
import { MockContentProvider } from "../src/lib/ai/providers/mock-provider.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../src/lib/ai/prompt-builder.ts";
import {
  addQuestion,
  approveAndPublish,
  deleteQuestion,
  generateStudyContent,
  getGenerationStatus,
  getStudentAssignment,
  listStudentAssignments,
  moveQuestion,
  publishAssignment,
  saveStudyContent,
  startStudyContentGeneration,
  updateQuestion,
} from "../src/lib/content/content-service.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

/** A teacher with a 5th-grade classroom, an enrolled student and a DRAFT assignment with 2 outcomes. */
async function setup(outcomeCount = 2) {
  const { teacher, rooms } = await makeTeacher([{ name: "5/A", grade: 5 }]);
  const student = await makeStudent([rooms[0].id]);
  const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");
  const chosen = outcomes.slice(0, outcomeCount);
  const res = await createAssignment(
    teacher.id,
    { classroomId: rooms[0].id, subject: "Fen Bilimleri", unitOrTheme, topic: "Güneş'in yapısı", outcomeIds: chosen.map((o) => o.id), minimumScore: 70, deadline: inDays(7), questionCount: 5 },
    db,
  );
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return { teacher, student, classroom: rooms[0], assignment: res.data, outcomes: chosen };
}

const manualContent = {
  introduction: "Bu derste Güneş'in yapısına hazırlanacağız.",
  keyConcepts: [{ term: "Güneş", explanation: "Dünya'ya en yakın yıldız." }],
  summary: "Kısa özet.",
  simpleExample: "Gündüz ışığın kaynağı Güneş'tir.",
  mustKnow: ["Güneş bir yıldızdır.", "Güneş ısı ve ışık verir.", "Güneş kendi ekseni etrafında döner."],
};

const mcQuestion = (code: string) => ({
  type: "MULTIPLE_CHOICE",
  questionText: "Güneş nedir?",
  options: ["Gezegen", "Yıldız", "Uydu", "Kuyruklu yıldız"],
  correctAnswer: "Yıldız",
  explanation: "Güneş bir yıldızdır.",
  points: 10,
  curriculumOutcomeCodes: [code],
});

/** Provider stub returning a fixed raw payload (or throwing). */
const stubProvider = (raw: unknown | (() => never)): ContentGenerationProvider & { calls: PreparationContentInput[] } => {
  const calls: PreparationContentInput[] = [];
  return {
    name: "stub",
    model: "stub-model",
    calls,
    async generatePreparationContent(input) {
      calls.push(input);
      if (typeof raw === "function") (raw as () => never)();
      return { raw };
    },
  };
};

describe("manual content without AI", () => {
  it("works when no AI provider is configured", async () => {
    expect(getContentProvider({ NODE_ENV: "test" })).toBeNull();
    expect(getContentProvider({ NODE_ENV: "test", AI_PROVIDER: "anthropic" })).toBeNull(); // no key → disabled
    expect(getContentProvider({ NODE_ENV: "production", AI_PROVIDER: "mock" })).toBeNull(); // mock never in production

    const { teacher, assignment, outcomes } = await setup();
    const gen = await generateStudyContent(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: null });
    expect(gen.ok).toBe(false);
    if (!gen.ok) {
      expect(gen.status).toBe(503);
      expect(gen.errors._form[0]).toBe(AI_NOT_CONFIGURED_MESSAGE);
    }

    const saved = await saveStudyContent(teacher.id, assignment.id, manualContent, db);
    expect(saved.ok).toBe(true);
    const row = await db.studyContent.findUnique({ where: { assignmentId: assignment.id } });
    expect(row).toMatchObject({ status: "MANUAL_DRAFT", generatedBy: "TEACHER", summary: "Kısa özet." });

    const q = await addQuestion(teacher.id, assignment.id, mcQuestion(outcomes[0].outcomeCode), db);
    expect(q.ok).toBe(true);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(1);
  });
});

describe("AI generation", () => {
  it("sends only grounded MEB data to the provider and saves the result as AI_GENERATED_DRAFT", async () => {
    const { teacher, assignment, outcomes } = await setup();
    const provider = Object.assign(new MockContentProvider(), {});
    const res = await generateStudyContent(teacher.id, assignment.id, { scope: "ALL" }, { db, provider });
    expect(res.ok).toBe(true);

    const content = await db.studyContent.findUnique({ where: { assignmentId: assignment.id } });
    expect(content).toMatchObject({ status: "AI_GENERATED_DRAFT", generatedBy: "AI", teacherApprovedAt: null });
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(5);
    expect((await db.assignment.findUnique({ where: { id: assignment.id } }))!.status).toBe("DRAFT");

    const log = await db.contentGenerationLog.findFirst({ where: { assignmentId: assignment.id } });
    expect(log).toMatchObject({ status: "SUCCEEDED", provider: "mock", scope: "ALL" });
    expect(log!.generatedAt).not.toBeNull();

    // Prompt contents: grounding rule + only the selected outcomes.
    expect(SYSTEM_PROMPT).toContain("Yalnızca sana verilen MEB öğrenme çıktıları ve curriculum bağlamını kullan.");
    const prompt = buildUserPrompt({ scope: "ALL", subject: "Fen Bilimleri", grade: 5, unitOrTheme: assignment.unitOrTheme, teacherTopic: assignment.topic, questionCount: 5, outcomes: outcomes.map((o) => ({ code: o.outcomeCode, text: o.outcomeText, processComponents: [] })) });
    for (const o of outcomes) expect(prompt).toContain(o.outcomeCode);
  });

  it("does not write invalid AI output to the database and logs it safely", async () => {
    const { teacher, assignment, outcomes } = await setup();
    const bad = stubProvider({ introduction: "x", summary: 42, questions: "not-a-list" });
    const res = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: bad });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("INVALID_RESPONSE");
      expect(res.errors._form[0]).toMatch(/İçerik oluşturulamadı/);
    }
    expect(await db.studyContent.count({ where: { assignmentId: assignment.id } })).toBe(0);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(0);
    const log = await db.contentGenerationLog.findFirst({ where: { assignmentId: assignment.id } });
    expect(log!.status).toBe("INVALID_RESPONSE");
    expect(log!.errorMessage).not.toContain("not-a-list"); // schema paths only, no raw output

    // Well-formed output citing an outcome the teacher did not select is rejected too.
    const mock = await new MockContentProvider().generatePreparationContent({
      scope: "ALL", subject: "Fen Bilimleri", grade: 5, unitOrTheme: "u", teacherTopic: "t", questionCount: 5,
      outcomes: outcomes.map((o) => ({ code: o.outcomeCode, text: o.outcomeText, processComponents: [] })),
    });
    const tampered = structuredClone(mock.raw) as { questions: { curriculumOutcomeCodes: string[] }[] };
    tampered.questions[0].curriculumOutcomeCodes = ["FB.5.9.9"];
    const res2 = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: stubProvider(tampered) });
    expect(res2.ok).toBe(false);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(0);
  });

  it("reports a timeout without saving anything", async () => {
    const { teacher, assignment } = await setup();
    const slow = stubProvider(() => {
      throw new ProviderError("TIMEOUT", "timeout");
    });
    const res = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: slow });
    expect(!res.ok && res.status).toBe(504);
    expect(!res.ok && res.errors._form[0]).toBe("İçerik oluşturulamadı. Tekrar deneyebilir veya içeriği manuel hazırlayabilirsiniz.");
    expect((await db.contentGenerationLog.findFirst({ where: { assignmentId: assignment.id } }))!.status).toBe("TIMEOUT");
  });

  it("blocks a second generation while one is running and asks before overwriting", async () => {
    const { teacher, assignment } = await setup();
    await db.contentGenerationLog.create({ data: { assignmentId: assignment.id, teacherId: teacher.id, scope: "ALL", provider: "mock", model: "m", status: "RUNNING" } });
    const provider = stubProvider({});
    const busy = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider });
    expect(!busy.ok && busy.code).toBe("IN_PROGRESS");
    expect(provider.calls).toHaveLength(0);
    await db.contentGenerationLog.updateMany({ where: { assignmentId: assignment.id }, data: { status: "FAILED" } });

    await saveStudyContent(teacher.id, assignment.id, manualContent, db);
    const needsConfirm = await generateStudyContent(teacher.id, assignment.id, { scope: "SUMMARY" }, { db, provider: new MockContentProvider() });
    expect(!needsConfirm.ok && needsConfirm.code).toBe("CONFIRM_OVERWRITE");
    expect((await db.studyContent.findUnique({ where: { assignmentId: assignment.id } }))!.summary).toBe("Kısa özet.");
    const confirmed = await generateStudyContent(teacher.id, assignment.id, { scope: "SUMMARY", confirmOverwrite: true }, { db, provider: new MockContentProvider() });
    expect(confirmed.ok).toBe(true);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(0); // SUMMARY leaves questions alone
  });
});

describe("background generation job", () => {
  it("starts at once, reports RUNNING, then SUCCEEDED with the saved draft", async () => {
    const { teacher, assignment } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const mock = new MockContentProvider();
    const slow: ContentGenerationProvider = {
      name: "slow",
      model: "slow-model",
      async generatePreparationContent(input) {
        await gate;
        return mock.generatePreparationContent(input);
      },
    };
    const started = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: slow });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const running = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(running.ok && running.data).toMatchObject({ state: "RUNNING", jobId: started.data.jobId, scope: "ALL" });

    const job = started.data.run();
    release();
    expect((await job).ok).toBe(true);
    const done = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(done.ok && done.data.state).toBe("SUCCEEDED");
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(5);

    // Another teacher can't read the job.
    const { teacher: other } = await makeTeacher([{ name: "6/B", grade: 6 }]);
    const foreign = await getGenerationStatus(other.id, assignment.id, { db });
    expect(!foreign.ok && foreign.status).toBe(403);
  });

  it("reports failures with a Turkish message and closes a job whose run never finished", async () => {
    const { teacher, assignment } = await setup();
    const failing = stubProvider(() => {
      throw new ProviderError("TIMEOUT", "timeout");
    });
    const res = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: failing });
    expect(res.ok).toBe(false);
    const failed = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(failed.ok && failed.data).toMatchObject({ state: "FAILED", message: expect.stringMatching(/zamanında gelmedi/) });

    // A RUNNING row left behind by a stopped function: reported as failed and no longer blocks a retry.
    await db.contentGenerationLog.create({
      data: { assignmentId: assignment.id, teacherId: teacher.id, scope: "ALL", provider: "evren", model: "m", status: "RUNNING", startedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const stale = await getGenerationStatus(teacher.id, assignment.id, { db, timeoutMs: 150_000 });
    expect(stale.ok && stale.data.state).toBe("FAILED");
    const retry = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider(), timeoutMs: 150_000 });
    expect(retry.ok).toBe(true);
  });

  it("closes the job as FAILED when saving the draft throws", async () => {
    const { teacher, assignment } = await setup();
    const started = await startStudyContentGeneration(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    if (!started.ok) throw new Error("not started");
    await db.assignment.delete({ where: { id: assignment.id } }); // the draft can no longer be saved
    const res = await started.data.run();
    expect(res.ok).toBe(false);
  });
});

describe("teacher editing", () => {
  it("lets the teacher edit content, add, update, reorder and delete questions", async () => {
    const { teacher, assignment, outcomes } = await setup();
    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });

    const edited = await saveStudyContent(teacher.id, assignment.id, { ...manualContent, summary: "Öğretmenin özeti" }, db);
    expect(edited.ok).toBe(true);
    const content = await db.studyContent.findUnique({ where: { assignmentId: assignment.id } });
    expect(content).toMatchObject({ summary: "Öğretmenin özeti", status: "AI_GENERATED_DRAFT" });
    expect(content!.teacherEditedAt).not.toBeNull();

    const added = await addQuestion(teacher.id, assignment.id, mcQuestion(outcomes[1].outcomeCode), db);
    expect(added.ok).toBe(true);
    const all = await db.question.findMany({ where: { assignmentId: assignment.id }, orderBy: { orderNum: "asc" } });
    expect(all).toHaveLength(6);
    expect(all[5].generatedBy).toBe("TEACHER");

    const upd = await updateQuestion(teacher.id, assignment.id, all[0].id, { type: "TRUE_FALSE", questionText: "Güneş bir yıldızdır.", correctAnswer: true, points: 15, curriculumOutcomeCodes: [outcomes[0].outcomeCode] }, db);
    expect(upd.ok).toBe(true);
    expect(await db.question.findUnique({ where: { id: all[0].id } })).toMatchObject({ type: "TRUE_FALSE", points: 15, data: { correctAnswer: true } });

    const moved = await moveQuestion(teacher.id, assignment.id, all[5].id, "up", db);
    expect(moved.ok && moved.data.order[4]).toBe(all[5].id);

    const del = await deleteQuestion(teacher.id, assignment.id, all[1].id, db);
    expect(del.ok).toBe(true);
    const after = await db.question.findMany({ where: { assignmentId: assignment.id }, orderBy: { orderNum: "asc" } });
    expect(after.map((q) => q.id)).not.toContain(all[1].id);
    expect(after.map((q) => q.orderNum)).toEqual([1, 2, 3, 4, 5]);

    const invalid = await addQuestion(teacher.id, assignment.id, { ...mcQuestion(outcomes[0].outcomeCode), correctAnswer: "Yok" }, db);
    expect(invalid.ok).toBe(false);
    const foreignOutcome = await addQuestion(teacher.id, assignment.id, mcQuestion("FB.5.7.1"), db);
    expect(!foreignOutcome.ok && foreignOutcome.code).toBe("UNKNOWN_OUTCOME");
  });

  it("does not let another teacher change the content or questions", async () => {
    const { teacher, assignment, outcomes } = await setup();
    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    const q = await db.question.findFirstOrThrow({ where: { assignmentId: assignment.id } });
    const other = await makeTeacher([]);
    const id = other.teacher.id;

    const results = [
      await saveStudyContent(id, assignment.id, manualContent, db),
      await addQuestion(id, assignment.id, mcQuestion(outcomes[0].outcomeCode), db),
      await updateQuestion(id, assignment.id, q.id, mcQuestion(outcomes[0].outcomeCode), db),
      await deleteQuestion(id, assignment.id, q.id, db),
      await moveQuestion(id, assignment.id, q.id, "down", db),
      await generateStudyContent(id, assignment.id, { confirmOverwrite: true }, { db, provider: new MockContentProvider() }),
      await approveAndPublish(id, assignment.id, db),
    ];
    for (const r of results) expect(!r.ok && r.status).toBe(403);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(5);
    expect((await db.studyContent.findUnique({ where: { assignmentId: assignment.id } }))!.introduction).toContain("[Deneme taslağı]");
  });

  it("stores question → curriculum outcome links for AI and manual questions", async () => {
    const { teacher, assignment, outcomes } = await setup();
    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    await addQuestion(teacher.id, assignment.id, { ...mcQuestion(outcomes[0].outcomeCode), curriculumOutcomeCodes: outcomes.map((o) => o.outcomeCode) }, db);
    const questions = await db.question.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { orderNum: "asc" },
      include: { outcomes: { include: { outcome: true } } },
    });
    // Mock provider links question i to outcome (i mod 2).
    questions.slice(0, 5).forEach((q, i) => expect(q.outcomes.map((o) => o.outcome.outcomeCode)).toEqual([outcomes[i % 2].outcomeCode]));
    expect(questions[5].outcomes.map((o) => o.outcome.outcomeCode).sort()).toEqual(outcomes.map((o) => o.outcomeCode).sort());
    // Queryable from the outcome side (for analytics).
    const byOutcome = await db.questionOutcome.count({ where: { outcomeId: outcomes[0].id, question: { assignmentId: assignment.id } } });
    expect(byOutcome).toBe(4);
  });
});

describe("approval, publishing and student visibility", () => {
  it("keeps drafts invisible to students, even by direct id", async () => {
    const { teacher, student, assignment } = await setup();
    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    expect(await getStudentAssignment(student.id, assignment.id, db)).toBeNull();
    expect(await listStudentAssignments(student.id, db)).toEqual([]);

    // Even a PUBLISHED assignment is hidden while its content is not teacher-approved.
    await db.assignment.update({ where: { id: assignment.id }, data: { status: "PUBLISHED" } });
    expect(await getStudentAssignment(student.id, assignment.id, db)).toBeNull();
    await db.assignment.update({ where: { id: assignment.id }, data: { status: "DRAFT" } });
  });

  it("cannot publish without curriculum outcomes", async () => {
    const { teacher, classroom } = await makeTeacher([{ name: "5/Z", grade: 5 }]).then(({ teacher, rooms }) => ({ teacher, classroom: rooms[0] }));
    const { unitOrTheme } = await verifiedOutcomesOfFirstUnit(5, "Fen Bilimleri");
    const draft = await createAssignment(teacher.id, { classroomId: classroom.id, subject: "Fen Bilimleri", unitOrTheme, topic: "t", outcomeIds: [], minimumScore: 70, deadline: inDays(3) }, db);
    if (!draft.ok) throw new Error("setup");
    await saveStudyContent(teacher.id, draft.data.id, manualContent, db);
    await db.question.create({ data: { assignmentId: draft.data.id, type: "TRUE_FALSE", questionText: "?", data: { correctAnswer: true }, points: 10, orderNum: 1, generatedBy: "TEACHER" } });
    const res = await approveAndPublish(teacher.id, draft.data.id, db);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors._form).toContain("En az 1 MEB öğrenme çıktısı seçilmelidir.");
    expect((await db.assignment.findUnique({ where: { id: draft.data.id } }))!.status).toBe("DRAFT");
  });

  it("cannot publish content that is not teacher-approved, nor without content or questions", async () => {
    const { teacher, assignment } = await setup();
    const empty = await approveAndPublish(teacher.id, assignment.id, db);
    expect(!empty.ok && empty.errors._form).toEqual(expect.arrayContaining(["Hazırlık içeriği oluşturulmalıdır.", "En az 1 soru eklenmelidir."]));

    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    const notApproved = await publishAssignment(teacher.id, assignment.id, db);
    expect(!notApproved.ok && notApproved.errors._form).toContain("Hazırlık içeriği öğretmen tarafından onaylanmalıdır.");
    expect((await db.assignment.findUnique({ where: { id: assignment.id } }))!.status).toBe("DRAFT");

    await db.question.updateMany({ where: { assignmentId: assignment.id }, data: { points: 0 } });
    const zero = await approveAndPublish(teacher.id, assignment.id, db);
    expect(!zero.ok && zero.errors._form).toContain("Soruların toplam puanı 0'dan büyük olmalıdır.");
  });

  it("approves and publishes in one step; enrolled students then see it without answers", async () => {
    const { teacher, student, assignment } = await setup();
    await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider() });
    const res = await approveAndPublish(teacher.id, assignment.id, db);
    expect(res.ok).toBe(true);

    const [a, c] = await Promise.all([
      db.assignment.findUnique({ where: { id: assignment.id } }),
      db.studyContent.findUnique({ where: { assignmentId: assignment.id } }),
    ]);
    expect(a!.status).toBe("PUBLISHED");
    expect(a!.publishedAt).not.toBeNull();
    expect(c!.status).toBe("TEACHER_APPROVED");
    expect(c!.teacherApprovedAt).not.toBeNull();

    const view = await getStudentAssignment(student.id, assignment.id, db);
    expect(view).not.toBeNull();
    expect(view!.questions).toHaveLength(5);
    const serializedQuestions = JSON.stringify(view!.questions);
    for (const secret of ["correctAnswer", "correctOrder", "sampleAnswer", "explanation", "pairs", "acceptableAnswers"]) {
      expect(serializedQuestions).not.toContain(secret);
    }
    expect((await listStudentAssignments(student.id, db)).map((x) => x.id)).toContain(assignment.id);

    // A student of another classroom still cannot see it.
    const outsider = await makeStudent([]);
    expect(await getStudentAssignment(outsider.id, assignment.id, db)).toBeNull();

    // After publishing: questions stay editable until a student starts (locking is covered in
    // assignment-management.test.ts), AI regeneration is blocked, content edits bump the version.
    const q = await db.question.findFirstOrThrow({ where: { assignmentId: assignment.id } });
    await db.studentAssignment.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
      create: { assignmentId: assignment.id, studentId: student.id, status: "ASSESSMENT_IN_PROGRESS", attempts: { create: { attemptNumber: 1, status: "IN_PROGRESS" } } },
      update: { attempts: { create: { attemptNumber: 1, status: "IN_PROGRESS" } } },
    });
    const locked = await deleteQuestion(teacher.id, assignment.id, q.id, db);
    expect(!locked.ok && locked.code).toBe("QUESTIONS_LOCKED");
    expect((await generateStudyContent(teacher.id, assignment.id, { confirmOverwrite: true }, { db, provider: new MockContentProvider() })).ok).toBe(false);
    await saveStudyContent(teacher.id, assignment.id, manualContent, db);
    const v2 = await db.studyContent.findUnique({ where: { assignmentId: assignment.id } });
    expect(v2).toMatchObject({ contentVersion: 2, status: "TEACHER_APPROVED", summary: "Kısa özet." });
  });
});
