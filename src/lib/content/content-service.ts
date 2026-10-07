// Server-side preparation content workflow:
//   AI or manual draft -> teacher edits -> "Onayla ve Yayınla" (one transaction) -> students.
// Every function re-checks assignment ownership; nothing trusts client-sent ids beyond lookup.

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";
import { AI_FAILED_MESSAGE, AI_NOT_CONFIGURED_MESSAGE, aiTimeoutMs, getContentProvider } from "../ai/index.ts";
import { ProviderError, type ContentGenerationProvider } from "../ai/content-generation-provider.ts";
import { GENERATION_SCOPES, parseGeneratedContent } from "../ai/response-schema.ts";
import { questionCountSchema, studyContentSchema } from "./study-content-schema.ts";
import { questionSchema, toQuestionRow, toStudentQuestion, type ValidQuestion } from "./question-schema.ts";
import { z } from "zod";

type Status = 400 | 403 | 404 | 409 | 502 | 503 | 504;
export type ContentResult<T> = { ok: true; data: T } | { ok: false; status: Status; code: string; errors: Record<string, string[]> };

const fail = (status: Status, code: string, message: string, field = "_form"): ContentResult<never> => ({
  ok: false,
  status,
  code,
  errors: { [field]: [message] },
});

const zodFail = (error: z.ZodError): ContentResult<never> => {
  const errors: Record<string, string[]> = {};
  for (const i of error.issues) (errors[i.path.join(".") || "_form"] ??= []).push(i.message);
  return { ok: false, status: 400, code: "VALIDATION", errors };
};

const assignmentInclude = {
  assignmentOutcomes: { include: { outcome: { select: { id: true, outcomeCode: true, outcomeText: true, processComponents: true } } } },
  studyContent: true,
  _count: { select: { questions: true } },
} satisfies Prisma.AssignmentInclude;

/** Load an assignment the teacher owns, or a 404/403 failure. */
async function loadOwned(db: PrismaClient, teacherId: string, assignmentId: string) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
  if (!a) return { error: fail(404, "NOT_FOUND", "Görev bulunamadı.") } as const;
  if (a.teacherId !== teacherId) return { error: fail(403, "FORBIDDEN", "Bu görev size ait değil.") } as const;
  return { assignment: a } as const;
}

/** Map outcome codes to the assignment's own outcome ids; unknown codes are an error. */
function resolveOutcomeIds(assignment: { assignmentOutcomes: { outcome: { id: string; outcomeCode: string } }[] }, codes: string[]) {
  const byCode = new Map(assignment.assignmentOutcomes.map((ao) => [ao.outcome.outcomeCode, ao.outcome.id]));
  const unknown = codes.filter((c) => !byCode.has(c));
  return { ids: [...new Set(codes)].filter((c) => byCode.has(c)).map((c) => byCode.get(c)!), unknown };
}

async function writeQuestions(tx: Prisma.TransactionClient, assignmentId: string, questions: ValidQuestion[], outcomeIdsFor: (q: ValidQuestion) => string[], generatedBy: "AI" | "TEACHER", startAt = 1) {
  for (const [i, q] of questions.entries()) {
    const { curriculumOutcomeCodes: _codes, data, ...row } = toQuestionRow(q);
    void _codes;
    await tx.question.create({
      data: {
        assignmentId,
        ...row,
        data: data as Prisma.InputJsonValue,
        orderNum: startAt + i,
        generatedBy,
        outcomes: { create: outcomeIdsFor(q).map((outcomeId) => ({ outcomeId })) },
      },
    });
  }
}

// ---------------------------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------------------------

const generateSchema = z.object({
  scope: z.enum(GENERATION_SCOPES).default("ALL"),
  questionCount: questionCountSchema.optional(),
  confirmOverwrite: z.boolean().default(false),
});

export interface GenerateDeps {
  db?: PrismaClient;
  provider?: ContentGenerationProvider | null;
  timeoutMs?: number;
}

/**
 * A RUNNING log older than the AI timeout plus this margin belongs to a run that never finished
 * (e.g. the serverless function was stopped). It no longer blocks a retry and is reported as failed.
 */
const STALE_MARGIN_MS = 45_000;
const staleAfterMs = (timeoutMs: number) => timeoutMs + STALE_MARGIN_MS;

export const AI_TIMEOUT_USER_MESSAGE = "Yapay zekâ yanıtı zamanında gelmedi. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.";
export const AI_INVALID_USER_MESSAGE = "Yapay zekâ geçerli bir taslak üretemedi. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.";

type GenerationOutcome = ContentResult<{ scope: string; questions: number | null }>;

/**
 * Phase 1 (fast, inside the request): validate, check ownership and take the per-assignment lock.
 * Returns the job id and `run`, phase 2, which calls the AI provider and saves the draft. `run`
 * never throws: every exit path closes the generation log, so a job can't stay RUNNING.
 */
export async function startStudyContentGeneration(teacherId: string, assignmentId: string, rawInput: unknown, deps: GenerateDeps = {}) {
  const db = deps.db ?? defaultPrisma;
  const provider = deps.provider === undefined ? getContentProvider() : deps.provider;
  const timeoutMs = deps.timeoutMs ?? aiTimeoutMs();
  const parsed = generateSchema.safeParse(rawInput ?? {});
  if (!parsed.success) return zodFail(parsed.error);
  const { scope, confirmOverwrite } = parsed.data;

  const loaded = await loadOwned(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const a = loaded.assignment;
  if (a.status !== "DRAFT") return fail(400, "NOT_DRAFT", "Yeniden oluşturma yalnızca taslak görevlerde yapılabilir.");
  if (a.assignmentOutcomes.length === 0) return fail(400, "NO_OUTCOMES", "İçerik oluşturmak için en az 1 MEB öğrenme çıktısı seçilmelidir.");
  if (!provider) return fail(503, "AI_NOT_CONFIGURED", AI_NOT_CONFIGURED_MESSAGE);

  // Don't silently replace existing work: the client must confirm overwriting.
  const overwritesContent = scope !== "QUESTIONS" && a.studyContent !== null;
  const overwritesQuestions = scope !== "SUMMARY" && a._count.questions > 0;
  if ((overwritesContent || overwritesQuestions) && !confirmOverwrite) {
    return fail(409, "CONFIRM_OVERWRITE", "Mevcut içerik/sorular değiştirilecek. Devam etmek için onaylayın.");
  }

  const questionCount = parsed.data.questionCount ?? a.questionCount;
  if (questionCount !== a.questionCount) await db.assignment.update({ where: { id: a.id }, data: { questionCount } });

  // Server-side double-click guard: one live RUNNING generation per assignment.
  const lock = await db.$transaction(async (tx) => {
    const running = await tx.contentGenerationLog.findFirst({
      where: { assignmentId: a.id, status: "RUNNING", startedAt: { gt: new Date(Date.now() - staleAfterMs(timeoutMs)) } },
    });
    if (running) return null;
    return tx.contentGenerationLog.create({ data: { assignmentId: a.id, teacherId, scope, provider: provider.name, model: provider.model, status: "RUNNING" } });
  });
  if (!lock) return fail(409, "IN_PROGRESS", "Bu görev için içerik zaten oluşturuluyor. Lütfen bekleyin.");

  const finish = (status: string, extra: Prisma.ContentGenerationLogUpdateInput = {}) =>
    db.contentGenerationLog.update({ where: { id: lock.id }, data: { status, finishedAt: new Date(), ...extra } });

  async function run(): Promise<GenerationOutcome> {
    let result;
    try {
      result = await provider!.generatePreparationContent(
        {
          scope,
          subject: a.subject,
          grade: a.grade,
          unitOrTheme: a.unitOrTheme,
          teacherTopic: a.topic,
          questionCount,
          outcomes: a.assignmentOutcomes.map(({ outcome }) => ({
            code: outcome.outcomeCode,
            text: outcome.outcomeText,
            processComponents: Array.isArray(outcome.processComponents) ? (outcome.processComponents as string[]) : [],
          })),
        },
        { signal: AbortSignal.timeout(timeoutMs) },
      );
    } catch (error) {
      const kind = error instanceof ProviderError ? error.kind : "FAILED";
      const status = kind === "TIMEOUT" ? "TIMEOUT" : kind === "REFUSED" ? "REFUSED" : kind === "INCOMPLETE" ? "INVALID_RESPONSE" : "FAILED";
      await finish(status, { errorMessage: error instanceof ProviderError ? error.message : "Beklenmeyen sağlayıcı hatası." }).catch(() => undefined);
      return fail(kind === "TIMEOUT" ? 504 : 502, status, AI_FAILED_MESSAGE);
    }

    try {
      const outcomeCodes = a.assignmentOutcomes.map((ao) => ao.outcome.outcomeCode);
      const checked = parseGeneratedContent(scope, result.raw, { questionCount, allowedOutcomeCodes: outcomeCodes });
      if (!checked.ok) {
        // Log schema paths only – never the raw model output.
        await finish("INVALID_RESPONSE", { errorMessage: checked.issues.slice(0, 20).join(" | ").slice(0, 2000) });
        return fail(502, "INVALID_RESPONSE", AI_FAILED_MESSAGE);
      }
      const { content, questions } = checked.value;

      await db.$transaction(async (tx) => {
        if (content) {
          const data = {
            ...content,
            status: "AI_GENERATED_DRAFT",
            generatedBy: "AI",
            aiModel: provider!.model,
            teacherEditedAt: null,
            teacherApprovedAt: null,
          };
          await tx.studyContent.upsert({ where: { assignmentId: a.id }, create: { assignmentId: a.id, ...data }, update: data });
        } else if (a.studyContent?.status === "TEACHER_APPROVED") {
          await tx.studyContent.update({ where: { assignmentId: a.id }, data: { status: "AI_GENERATED_DRAFT", teacherApprovedAt: null } });
        }
        if (questions) {
          await tx.question.deleteMany({ where: { assignmentId: a.id } });
          await writeQuestions(tx, a.id, questions, (q) => resolveOutcomeIds(a, q.curriculumOutcomeCodes).ids, "AI");
        }
      }, {
        maxWait: 10000,
        timeout: 20000,
      });
      await finish("SUCCEEDED", { generatedAt: new Date(), inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      return { ok: true, data: { scope, questions: questions?.length ?? null } } as const;
    } catch {
      await finish("FAILED", { errorMessage: "Taslak kaydedilemedi." }).catch(() => undefined);
      return fail(502, "FAILED", AI_FAILED_MESSAGE);
    }
  }

  return { ok: true, data: { jobId: lock.id, scope, run } } as const;
}

/** Generate and wait for the result (used by tests and scripts; the route runs phase 2 in the background). */
export async function generateStudyContent(teacherId: string, assignmentId: string, rawInput: unknown, deps: GenerateDeps = {}): Promise<GenerationOutcome> {
  const started = await startStudyContentGeneration(teacherId, assignmentId, rawInput, deps);
  if (!started.ok) return started;
  return started.data.run();
}

export type GenerationStatus =
  | { state: "NONE" }
  | { state: "RUNNING"; jobId: string; scope: string; startedAt: string }
  | { state: "SUCCEEDED"; jobId: string; scope: string; finishedAt: string | null }
  | { state: "FAILED"; jobId: string; scope: string; finishedAt: string | null; message: string };

const failureMessage = (status: string) =>
  status === "TIMEOUT" ? AI_TIMEOUT_USER_MESSAGE : status === "INVALID_RESPONSE" ? AI_INVALID_USER_MESSAGE : AI_FAILED_MESSAGE;

/** Latest generation job of an assignment the teacher owns. A RUNNING job past its deadline is closed as TIMEOUT. */
export async function getGenerationStatus(
  teacherId: string,
  assignmentId: string,
  { db = defaultPrisma, timeoutMs = aiTimeoutMs(), now = new Date() }: { db?: PrismaClient; timeoutMs?: number; now?: Date } = {},
): Promise<ContentResult<GenerationStatus>> {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { teacherId: true } });
  if (!a) return fail(404, "NOT_FOUND", "Görev bulunamadı.");
  if (a.teacherId !== teacherId) return fail(403, "FORBIDDEN", "Bu görev size ait değil.");
  let log = await db.contentGenerationLog.findFirst({ where: { assignmentId }, orderBy: { startedAt: "desc" } });
  if (!log) return { ok: true, data: { state: "NONE" } };
  if (log.status === "RUNNING" && log.startedAt.getTime() < now.getTime() - staleAfterMs(timeoutMs)) {
    log = await db.contentGenerationLog.update({
      where: { id: log.id },
      data: { status: "TIMEOUT", finishedAt: now, errorMessage: "İşlem süresi içinde tamamlanmadı (sunucu işlemi durdu)." },
    });
  }
  const base = { jobId: log.id, scope: log.scope };
  if (log.status === "RUNNING") return { ok: true, data: { state: "RUNNING", ...base, startedAt: log.startedAt.toISOString() } };
  const finishedAt = log.finishedAt?.toISOString() ?? null;
  if (log.status === "SUCCEEDED") return { ok: true, data: { state: "SUCCEEDED", ...base, finishedAt } };
  return { ok: true, data: { state: "FAILED", ...base, finishedAt, message: failureMessage(log.status) } };
}

// ---------------------------------------------------------------------------------------------
// Manual content
// ---------------------------------------------------------------------------------------------

/** Create (MANUAL_DRAFT) or edit the preparation content. */
export async function saveStudyContent(teacherId: string, assignmentId: string, rawInput: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = studyContentSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const loaded = await loadOwned(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const a = loaded.assignment;
  const now = new Date();

  if (!a.studyContent) {
    const created = await db.studyContent.create({
      data: { assignmentId: a.id, ...parsed.data, status: "MANUAL_DRAFT", generatedBy: "TEACHER", teacherEditedAt: now },
    });
    return { ok: true, data: created } as const;
  }
  // Editing approved content of a published assignment: the teacher's own edit stays approved,
  // with a new content version.
  const published = a.status === "PUBLISHED" && a.studyContent.status === "TEACHER_APPROVED";
  const updated = await db.studyContent.update({
    where: { id: a.studyContent.id },
    data: {
      ...parsed.data,
      teacherEditedAt: now,
      ...(published ? { contentVersion: { increment: 1 }, teacherApprovedAt: now } : {}),
    },
  });
  return { ok: true, data: updated } as const;
}

// ---------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------

async function loadEditableQuestions(db: PrismaClient, teacherId: string, assignmentId: string) {
  const loaded = await loadOwned(db, teacherId, assignmentId);
  if (loaded.error) return loaded;
  if (loaded.assignment.status !== "DRAFT") return { error: fail(400, "NOT_DRAFT", "Yayınlanmış görevin soruları değiştirilemez.") } as const;
  return loaded;
}

export async function addQuestion(teacherId: string, assignmentId: string, rawInput: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = questionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const loaded = await loadEditableQuestions(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const a = loaded.assignment;
  const { ids, unknown } = resolveOutcomeIds(a, parsed.data.curriculumOutcomeCodes);
  if (unknown.length) return fail(400, "UNKNOWN_OUTCOME", `Bu göreve ait olmayan öğrenme çıktısı: ${unknown.join(", ")}`, "curriculumOutcomeCodes");
  const last = await db.question.aggregate({ where: { assignmentId: a.id }, _max: { orderNum: true } });
  await db.$transaction((tx) => writeQuestions(tx, a.id, [parsed.data], () => ids, "TEACHER", (last._max.orderNum ?? 0) + 1));
  const created = await db.question.findFirst({ where: { assignmentId: a.id }, orderBy: { orderNum: "desc" }, include: { outcomes: true } });
  return { ok: true, data: created! } as const;
}

export async function updateQuestion(teacherId: string, assignmentId: string, questionId: string, rawInput: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = questionSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const loaded = await loadEditableQuestions(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const a = loaded.assignment;
  const existing = await db.question.findFirst({ where: { id: questionId, assignmentId: a.id } });
  if (!existing) return fail(404, "NOT_FOUND", "Soru bulunamadı.");
  const { ids, unknown } = resolveOutcomeIds(a, parsed.data.curriculumOutcomeCodes);
  if (unknown.length) return fail(400, "UNKNOWN_OUTCOME", `Bu göreve ait olmayan öğrenme çıktısı: ${unknown.join(", ")}`, "curriculumOutcomeCodes");
  const { curriculumOutcomeCodes: _codes, data, ...row } = toQuestionRow(parsed.data);
  void _codes;
  const updated = await db.$transaction(async (tx) => {
    await tx.questionOutcome.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: { ...row, data: data as Prisma.InputJsonValue, outcomes: { create: ids.map((outcomeId) => ({ outcomeId })) } },
      include: { outcomes: true },
    });
  });
  return { ok: true, data: updated } as const;
}

export async function deleteQuestion(teacherId: string, assignmentId: string, questionId: string, db: PrismaClient = defaultPrisma) {
  const loaded = await loadEditableQuestions(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const deleted = await db.question.deleteMany({ where: { id: questionId, assignmentId } });
  if (deleted.count === 0) return fail(404, "NOT_FOUND", "Soru bulunamadı.");
  await renumber(db, assignmentId);
  return { ok: true, data: { deleted: questionId } } as const;
}

export async function moveQuestion(teacherId: string, assignmentId: string, questionId: string, direction: unknown, db: PrismaClient = defaultPrisma) {
  if (direction !== "up" && direction !== "down") return fail(400, "VALIDATION", "Yön 'up' veya 'down' olmalıdır.");
  const loaded = await loadEditableQuestions(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const list = await db.question.findMany({ where: { assignmentId }, orderBy: { orderNum: "asc" }, select: { id: true } });
  const i = list.findIndex((q) => q.id === questionId);
  if (i < 0) return fail(404, "NOT_FOUND", "Soru bulunamadı.");
  const j = direction === "up" ? i - 1 : i + 1;
  if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  await db.$transaction(list.map((q, k) => db.question.update({ where: { id: q.id }, data: { orderNum: k + 1 } })));
  return { ok: true, data: { order: list.map((q) => q.id) } } as const;
}

async function renumber(db: PrismaClient, assignmentId: string) {
  const list = await db.question.findMany({ where: { assignmentId }, orderBy: { orderNum: "asc" }, select: { id: true } });
  await db.$transaction(list.map((q, k) => db.question.update({ where: { id: q.id }, data: { orderNum: k + 1 } })));
}

// ---------------------------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------------------------

type PublishCheck = Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }> & { questionPoints: number };

function publishProblems(a: PublishCheck, { requireApproved }: { requireApproved: boolean }): string[] {
  const p: string[] = [];
  if (a.assignmentOutcomes.length === 0) p.push("En az 1 MEB öğrenme çıktısı seçilmelidir.");
  if (!a.studyContent) p.push("Hazırlık içeriği oluşturulmalıdır.");
  else {
    if (!a.studyContent.introduction.trim() && !a.studyContent.summary.trim()) p.push("Konuya giriş veya konu özeti doldurulmalıdır.");
    if (requireApproved && a.studyContent.status !== "TEACHER_APPROVED") p.push("Hazırlık içeriği öğretmen tarafından onaylanmalıdır.");
  }
  if (a._count.questions === 0) p.push("En az 1 soru eklenmelidir.");
  else if (a.questionPoints <= 0) p.push("Soruların toplam puanı 0'dan büyük olmalıdır.");
  if (!Number.isInteger(a.minimumScore) || a.minimumScore < 0 || a.minimumScore > 100) p.push("Başarı eşiği 0–100 arasında olmalıdır.");
  if (a.deadline.getTime() <= Date.now()) p.push("Son tarih geçmiş; yeni bir son tarih gerekir.");
  return p;
}

async function loadForPublish(db: PrismaClient | Prisma.TransactionClient, teacherId: string, assignmentId: string) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, include: assignmentInclude });
  if (!a) return { error: fail(404, "NOT_FOUND", "Görev bulunamadı.") } as const;
  if (a.teacherId !== teacherId) return { error: fail(403, "FORBIDDEN", "Bu görev size ait değil.") } as const;
  const points = await db.question.aggregate({ where: { assignmentId }, _sum: { points: true } });
  return { assignment: { ...a, questionPoints: points._sum.points ?? 0 } } as const;
}

/**
 * Publish an assignment whose content is ALREADY teacher-approved. Fails otherwise – used as the
 * final guard and by any caller that must not approve implicitly.
 */
export async function publishAssignment(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const loaded = await loadForPublish(db, teacherId, assignmentId);
  if (loaded.error) return loaded.error;
  const a = loaded.assignment;
  if (a.status === "PUBLISHED") return { ok: true, data: a } as const;
  const problems = publishProblems(a, { requireApproved: true });
  if (problems.length) return { ok: false, status: 400, code: "NOT_PUBLISHABLE", errors: { _form: problems } } as const;
  const updated = await db.assignment.update({ where: { id: a.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  return { ok: true, data: updated } as const;
}

/** "Onayla ve Yayınla": approve the content and publish the assignment in one transaction. */
export async function approveAndPublish(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  return db.$transaction(async (tx) => {
    const loaded = await loadForPublish(tx, teacherId, assignmentId);
    if (loaded.error) return loaded.error;
    const a = loaded.assignment;
    if (a.status === "PUBLISHED") return fail(400, "ALREADY_PUBLISHED", "Görev zaten yayında.");
    const problems = publishProblems(a, { requireApproved: false });
    if (problems.length) return { ok: false, status: 400, code: "NOT_PUBLISHABLE", errors: { _form: problems } } as const;
    const now = new Date();
    await tx.studyContent.update({ where: { assignmentId: a.id }, data: { status: "TEACHER_APPROVED", teacherApprovedAt: now } });
    const updated = await tx.assignment.update({ where: { id: a.id }, data: { status: "PUBLISHED", publishedAt: now } });
    return { ok: true, data: updated } as const;
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
}

// ---------------------------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------------------------

export async function getTeacherContent(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    include: {
      classroom: { select: { name: true } },
      studyContent: true,
      assignmentOutcomes: { include: { outcome: { select: { id: true, outcomeCode: true, outcomeText: true } } } },
      questions: { orderBy: { orderNum: "asc" }, include: { outcomes: { include: { outcome: { select: { outcomeCode: true } } } } } },
      generationLogs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true, startedAt: true, model: true } },
    },
  });
  return a;
}

/**
 * The only way students read preparation content: the assignment must be PUBLISHED, its content
 * TEACHER_APPROVED and the student a member of the classroom. Correct answers are stripped.
 */
export async function getStudentAssignment(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const a = await db.assignment.findFirst({
    where: {
      id: assignmentId,
      status: "PUBLISHED",
      studyContent: { is: { status: "TEACHER_APPROVED" } },
      classroom: { members: { some: { studentId } } },
    },
    include: {
      classroom: { select: { name: true } },
      studyContent: true,
      assignmentOutcomes: { include: { outcome: { select: { outcomeCode: true, outcomeText: true } } } },
      questions: { orderBy: { orderNum: "asc" } },
    },
  });
  if (!a || !a.studyContent) return null;
  const c = a.studyContent;
  return {
    id: a.id,
    topic: a.topic,
    subject: a.subject,
    grade: a.grade,
    unitOrTheme: a.unitOrTheme,
    classroom: a.classroom.name,
    deadline: a.deadline,
    minimumScore: a.minimumScore,
    outcomes: a.assignmentOutcomes.map((ao) => ao.outcome),
    content: {
      introduction: c.introduction,
      keyConcepts: c.keyConcepts as { term: string; explanation: string }[],
      summary: c.summary,
      simpleExample: c.simpleExample,
      mustKnow: c.mustKnow as string[],
      contentVersion: c.contentVersion,
    },
    questions: a.questions.map(toStudentQuestion),
  };
}

export async function listStudentAssignments(studentId: string, db: PrismaClient = defaultPrisma) {
  return db.assignment.findMany({
    where: { status: "PUBLISHED", studyContent: { is: { status: "TEACHER_APPROVED" } }, classroom: { members: { some: { studentId } } } },
    orderBy: { deadline: "asc" },
    select: { id: true, topic: true, subject: true, deadline: true, classroom: { select: { name: true } } },
  });
}
