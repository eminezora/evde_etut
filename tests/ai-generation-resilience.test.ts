import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssignment } from "../src/lib/assignments/assignment-service.ts";
import { ProviderError, type ContentGenerationProvider } from "../src/lib/ai/content-generation-provider.ts";
import { MockContentProvider } from "../src/lib/ai/providers/mock-provider.ts";
import {
  generateStudyContent,
  getGenerationStatus,
  recoverAllStaleGenerations,
  startStudyContentGeneration,
} from "../src/lib/content/content-service.ts";
import { db, ensureCurriculum, inDays, makeStudent, makeTeacher, verifiedOutcomesOfFirstUnit } from "./helpers.ts";

beforeAll(ensureCurriculum);
afterAll(() => db.$disconnect());

async function setupAssignment() {
  const { teacher, rooms } = await makeTeacher([{ name: "6/C", grade: 6 }]);
  const student = await makeStudent([rooms[0].id]);
  const { unitOrTheme, outcomes } = await verifiedOutcomesOfFirstUnit(6, "Fen Bilimleri");
  const res = await createAssignment(
    teacher.id,
    {
      classroomId: rooms[0].id,
      subject: "Fen Bilimleri",
      unitOrTheme,
      topic: "Hücre ve Bölünmeler",
      outcomeIds: [outcomes[0].id],
      minimumScore: 70,
      deadline: inDays(7),
      questionCount: 5,
    },
    db,
  );
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return { teacher, student, classroom: rooms[0], assignment: res.data, outcome: outcomes[0] };
}

describe("AI generation state machine & resilience", () => {
  it("transitions IDLE -> GENERATING -> SUCCESS cleanly and saves draft", async () => {
    const { teacher, assignment } = await setupAssignment();

    // 1. Initial status is IDLE
    const initial = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(initial.ok && initial.data.state).toBe("IDLE");

    // 2. Start generation -> status is GENERATING
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const mock = new MockContentProvider();
    const controlled: ContentGenerationProvider = {
      name: "controlled",
      model: "mock-m",
      async generatePreparationContent(input) {
        await gate;
        return mock.generatePreparationContent(input);
      },
    };

    const started = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: controlled });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const generating = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(generating.ok).toBe(true);
    if (!generating.ok) return;
    expect(generating.data.state).toBe("GENERATING");
    expect(generating.data.generationStartedAt).toBeDefined();

    // 3. Complete run -> status becomes SUCCESS
    const jobPromise = started.data.run();
    release();
    const result = await jobPromise;
    expect(result.ok).toBe(true);

    const success = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(success.ok).toBe(true);
    if (!success.ok) return;
    expect(success.data.state).toBe("SUCCESS");
    expect(success.data.generationFinishedAt).toBeDefined();

    // Draft is stored in DB
    const studyContent = await db.studyContent.findUnique({ where: { assignmentId: assignment.id } });
    expect(studyContent?.status).toBe("AI_GENERATED_DRAFT");
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(5);
  });

  it("transitions GENERATING -> TIMEOUT when provider times out", async () => {
    const { teacher, assignment } = await setupAssignment();
    const timeoutProvider: ContentGenerationProvider = {
      name: "timeout",
      model: "m",
      async generatePreparationContent() {
        throw new ProviderError("TIMEOUT", "zaman aşımı");
      },
    };

    const started = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: timeoutProvider });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const res = await started.data.run();
    expect(res.ok).toBe(false);

    const status = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.state).toBe("TIMEOUT");
    expect(status.data.generationErrorCode).toBe("TIMEOUT");
    expect(status.data.message).toMatch(/zamanında gelmedi/);
  });

  it("transitions GENERATING -> FAILED when provider fails with unhandled error", async () => {
    const { teacher, assignment } = await setupAssignment();
    const crashProvider: ContentGenerationProvider = {
      name: "crash",
      model: "m",
      async generatePreparationContent() {
        throw new Error("unexpected upstream crash");
      },
    };

    const started = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: crashProvider });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const res = await started.data.run();
    expect(res.ok).toBe(false);

    const status = await getGenerationStatus(teacher.id, assignment.id, { db });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.state).toBe("FAILED");
    expect(status.data.generationErrorCode).toBe("FAILED");
  });

  it("automatically recovers a stale RUNNING job on GET and permits immediate retry", async () => {
    const { teacher, assignment } = await setupAssignment();

    // Simulate an abandoned RUNNING log from 10 minutes ago
    const oldStartedAt = new Date(Date.now() - 10 * 60_000);
    const staleLog = await db.contentGenerationLog.create({
      data: {
        assignmentId: assignment.id,
        teacherId: teacher.id,
        scope: "ALL",
        provider: "evren",
        model: "glm-5.3",
        status: "RUNNING",
        startedAt: oldStartedAt,
      },
    });

    // 1. GET request automatically discovers it is stale, marks it TIMEOUT, and reports isStaleRecovered
    const status = await getGenerationStatus(teacher.id, assignment.id, { db, timeoutMs: 90_000 });
    expect(status.ok).toBe(true);
    if (!status.ok) return;
    expect(status.data.state).toBe("TIMEOUT");
    expect(status.data.isStaleRecovered).toBe(true);
    expect(status.data.message).toMatch(/tamamlanamadı/);

    // Verify DB log was updated to TIMEOUT
    const updatedLog = await db.contentGenerationLog.findUnique({ where: { id: staleLog.id } });
    expect(updatedLog?.status).toBe("TIMEOUT");
    expect(updatedLog?.finishedAt).not.toBeNull();

    // 2. Teacher can immediately start a new generation without hitting 409 IN_PROGRESS
    const retry = await generateStudyContent(teacher.id, assignment.id, {}, { db, provider: new MockContentProvider(), timeoutMs: 90_000 });
    expect(retry.ok).toBe(true);
    expect(await db.question.count({ where: { assignmentId: assignment.id } })).toBe(5);
  });

  it("blocks duplicate parallel requests during active generation, but unblocks after finish", async () => {
    const { teacher, assignment } = await setupAssignment();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: ContentGenerationProvider = {
      name: "slow",
      model: "m",
      async generatePreparationContent(input) {
        await gate;
        return new MockContentProvider().generatePreparationContent(input);
      },
    };

    const first = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: slow });
    expect(first.ok).toBe(true);

    // Second request while first is actively RUNNING -> 409 IN_PROGRESS
    const second = await startStudyContentGeneration(teacher.id, assignment.id, { scope: "ALL" }, { db, provider: slow });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(409);
      expect(second.code).toBe("IN_PROGRESS");
    }

    if (first.ok) {
      const p = first.data.run();
      release();
      await p;
    }

    // After finish, new generation is allowed (with confirmOverwrite)
    const third = await generateStudyContent(teacher.id, assignment.id, { confirmOverwrite: true }, { db, provider: new MockContentProvider() });
    expect(third.ok).toBe(true);
  });

  it("recovers all stale generations in bulk via recoverAllStaleGenerations", async () => {
    const { teacher, assignment } = await setupAssignment();
    await db.contentGenerationLog.create({
      data: {
        assignmentId: assignment.id,
        teacherId: teacher.id,
        scope: "ALL",
        provider: "evren",
        model: "m",
        status: "RUNNING",
        startedAt: new Date(Date.now() - 5 * 60_000),
      },
    });

    const recovered = await recoverAllStaleGenerations(db, 60_000);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const log = await db.contentGenerationLog.findFirst({ where: { assignmentId: assignment.id }, orderBy: { startedAt: "desc" } });
    expect(log?.status).toBe("TIMEOUT");
  });
});
