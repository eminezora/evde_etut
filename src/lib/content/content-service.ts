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
import { USAGE_LIMIT_REACHED, commitUsage, refundUsage, reserveUsage } from "../usage/usage-quota-service.ts";

type Status = 400 | 403 | 404 | 409 | 429 | 502 | 503 | 504;
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

type ProviderResult = Awaited<ReturnType<ContentGenerationProvider["generatePreparationContent"]>>;

/** A part that has not answered after this long gets one duplicate request (whichever answers first wins). */
export const HEDGE_AFTER_MS = 50_000;

/**
 * Hedged request: EVREN usually answers a half-size request in 20–35 s, but now and then a single
 * request stalls for minutes. If the first request is still running after `hedgeAfterMs`, the same
 * request is sent once more; the first answer wins and the other request is aborted. An error before
 * the hedge fires is returned at once (the provider already retried transient errors).
 */
export function hedged<T>(run: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, hedgeAfterMs = HEDGE_AFTER_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controllers: AbortController[] = [];
    let settled = false;
    let running = 0;
    let hedgeFired = false;
    let lastError: unknown;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const c of controllers) c.abort();
      fn();
    };
    const launch = () => {
      const c = new AbortController();
      controllers.push(c);
      running++;
      run(AbortSignal.any([parent, c.signal])).then(
        (value) => finish(() => resolve(value)),
        (error) => {
          running--;
          lastError = error;
          if (running === 0 && (hedgeFired || parent.aborted)) finish(() => reject(lastError));
          else if (!hedgeFired) finish(() => reject(error));
        },
      );
    };
    const timer = setTimeout(() => {
      if (settled || parent.aborted) return;
      hedgeFired = true;
      launch();
    }, hedgeAfterMs);
    parent.addEventListener("abort", () => clearTimeout(timer), { once: true });
    launch();
  });
}

/**
 * "ALL" is requested as two parallel calls (preparation content + questions). The model's output
 * speed is the bottleneck (~30–40 tokens/s), so two half-size answers arrive in roughly half the
 * time of one full answer. Each part is hedged against a stalled request. The merged object goes
 * through the same strict ALL validation.
 */
export async function generateWithProvider(
  provider: ContentGenerationProvider,
  input: Parameters<ContentGenerationProvider["generatePreparationContent"]>[0],
  opts: { signal: AbortSignal; hedgeAfterMs?: number },
): Promise<ProviderResult> {
  const call = (part: typeof input) => hedged((signal) => provider.generatePreparationContent(part, { signal }), opts.signal, opts.hedgeAfterMs);
  if (input.scope !== "ALL") return call(input);
  const [content, questions] = await Promise.all([call({ ...input, scope: "SUMMARY" }), call({ ...input, scope: "QUESTIONS" })]);
  const asObject = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const sum = (a?: number, b?: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0));
  return {
    raw: { ...asObject(content.raw), questions: asObject(questions.raw).questions },
    inputTokens: sum(content.inputTokens, questions.inputTokens),
    outputTokens: sum(content.outputTokens, questions.outputTokens),
  };
}

export interface GenerateDeps {
  db?: PrismaClient;
  provider?: ContentGenerationProvider | null;
  timeoutMs?: number;
  /** Role whose usage quota applies (default TEACHER – the generate route is teacher-only). */
  quotaRole?: string;
}

/**
 * A RUNNING log older than the AI timeout plus this margin belongs to a run that never finished
 * (e.g. the serverless function was stopped). It no longer blocks a retry and is reported as failed.
 */
export const STALE_MARGIN_MS = 6_000;
export const staleThresholdMs = (timeoutMs: number) => timeoutMs + STALE_MARGIN_MS;

export const AI_TIMEOUT_USER_MESSAGE = "Yapay zekâ yanıtı zamanında gelmedi. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.";
export const AI_INVALID_USER_MESSAGE = "Yapay zekâ geçerli bir taslak üretemedi. Lütfen tekrar deneyin veya içeriği manuel hazırlayın.";

export type GenerationState = "IDLE" | "GENERATING" | "SUCCESS" | "FAILED" | "TIMEOUT";

export type GenerationOutcome = ContentResult<{ scope: string; questions: number | null }>;

function logLifecycle(event: string, meta: Record<string, unknown>) {
  const parts = Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(`[ai:lifecycle] ${event}: ${parts}`);
}

function logLifecycleError(event: string, meta: Record<string, unknown>) {
  const parts = Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ");
  console.error(`[ai:lifecycle] ${event}: ${parts}`);
}

/**
 * Recovers all stuck RUNNING logs across the database that exceeded the stale threshold.
 * Non-destructive: only updates technical log rows, never touches assignments or student attempts.
 */
export async function recoverAllStaleGenerations(db: PrismaClient = defaultPrisma, timeoutMs = aiTimeoutMs()): Promise<number> {
  const threshold = new Date(Date.now() - staleThresholdMs(timeoutMs));
  const staleJobs = await db.contentGenerationLog.findMany({ where: { status: "RUNNING", startedAt: { lte: threshold } }, select: { id: true, teacherId: true } });
  const stale = await db.contentGenerationLog.updateMany({
    where: {
      id: { in: staleJobs.map((j) => j.id) },
      status: "RUNNING",
    },
    data: {
      status: "TIMEOUT",
      finishedAt: new Date(),
      errorMessage: "İşlem süresi aşıldığı için sistem tarafından sonlandırıldı.",
    },
  });
  // A job that never finished never produced a draft: give its quota unit back.
  for (const j of staleJobs) await refundUsage(j.teacherId, "AI_CONTENT_GENERATION", j.id, db).catch(() => undefined);
  if (stale.count > 0) {
    logLifecycle("stale_generation_recovered", { count: stale.count });
  }
  return stale.count;
}

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

  // Server-side double-click guard with automatic stale recovery:
  const thresholdDate = new Date(Date.now() - staleThresholdMs(timeoutMs));
  const staleJobIds: string[] = [];
  const lock = await db.$transaction(async (tx) => {
    // 1. Recover any stale RUNNING job for this assignment
    const staleLogs = await tx.contentGenerationLog.findMany({
      where: { assignmentId: a.id, status: "RUNNING", startedAt: { lte: thresholdDate } },
    });
    for (const stale of staleLogs) {
      staleJobIds.push(stale.id);
      logLifecycle("stale_generation_recovered", { assignment: a.id, jobId: stale.id });
      await tx.contentGenerationLog.update({
        where: { id: stale.id },
        data: {
          status: "TIMEOUT",
          finishedAt: new Date(),
          errorMessage: "Zaman aşımı (yeni istek başlatıldığı için sonlandırıldı).",
        },
      });
    }

    // 2. Check for active RUNNING job
    const activeRunning = await tx.contentGenerationLog.findFirst({
      where: { assignmentId: a.id, status: "RUNNING", startedAt: { gt: thresholdDate } },
    });
    if (activeRunning) return null;

    // 3. Create new RUNNING log
    return tx.contentGenerationLog.create({
      data: { assignmentId: a.id, teacherId, scope, provider: provider.name, model: provider.model, status: "RUNNING" },
    });
  });

  for (const id of staleJobIds) await refundUsage(teacherId, "AI_CONTENT_GENERATION", id, db).catch(() => undefined);
  if (!lock) return fail(409, "IN_PROGRESS", "Bu görev için içerik zaten oluşturuluyor. Lütfen bekleyin.");
  const lockRecord = lock;

  // Usage quota: take one unit before EVREN is called (idempotent per job id). Only a successful
  // draft keeps it; failures and timeouts give it back (see the run wrapper below).
  const quotaUser = { id: teacherId, role: deps.quotaRole ?? "TEACHER" };
  const reservation = await reserveUsage(quotaUser, "AI_CONTENT_GENERATION", lockRecord.id, { db });
  if (!reservation.ok) {
    await db.contentGenerationLog.delete({ where: { id: lockRecord.id } }).catch(() => undefined);
    return { ok: false as const, status: 429 as const, code: USAGE_LIMIT_REACHED, errors: { _form: [reservation.message] } };
  }

  const finish = async (status: string, extra: Prisma.ContentGenerationLogUpdateInput = {}) => {
    try {
      return await db.contentGenerationLog.update({ where: { id: lockRecord.id }, data: { status, finishedAt: new Date(), ...extra } });
    } catch (err) {
      logLifecycleError("db_save_failed", { assignment: a.id, jobId: lockRecord.id, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  };

  async function runJob(): Promise<GenerationOutcome> {
    const startedAt = Date.now();
    logLifecycle("generation_started", { assignment: a.id, jobId: lockRecord.id, scope, provider: provider!.name, model: provider!.model });

    try {
      const providerInput = {
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
      };
      const outcomeCodes = a.assignmentOutcomes.map((ao) => ao.outcome.outcomeCode);
      const signal = AbortSignal.timeout(timeoutMs);
      // Retry only while at least half the budget is left, so a retry can still finish in time.
      const canRetry = (attempt: number) => attempt === 1 && Date.now() - startedAt < timeoutMs / 2;

      let result: Awaited<ReturnType<ContentGenerationProvider["generatePreparationContent"]>> | undefined;
      let checked: ReturnType<typeof parseGeneratedContent> | undefined;

      for (let attempt = 1; attempt <= 2; attempt++) {
        logLifecycle("evren_request_started", { assignment: a.id, attempt });
        try {
          result = await generateWithProvider(provider!, providerInput, { signal });
          logLifecycle("evren_response_received", { assignment: a.id, attempt, elapsed_ms: Date.now() - startedAt });
        } catch (error) {
          const kind = error instanceof ProviderError ? error.kind : "FAILED";
          logLifecycleError("evren_request_failed", { assignment: a.id, attempt, kind, error: error instanceof Error ? error.message : String(error) });
          if (kind === "INCOMPLETE" && canRetry(attempt)) {
            logLifecycle("retrying_generation", { assignment: a.id });
            continue;
          }
          const isTimeout = kind === "TIMEOUT" || signal.aborted;
          const status = isTimeout ? "TIMEOUT" : kind === "REFUSED" ? "REFUSED" : kind === "INCOMPLETE" ? "INVALID_RESPONSE" : "FAILED";
          logLifecycleError(isTimeout ? "generation_timeout" : "generation_failed", { assignment: a.id, elapsed_ms: Date.now() - startedAt });
          await finish(status, { errorMessage: error instanceof ProviderError ? error.message : "Beklenmeyen sağlayıcı hatası." });
          return fail(isTimeout ? 504 : 502, status, AI_FAILED_MESSAGE);
        }

        try {
          checked = parseGeneratedContent(scope, result.raw, { questionCount, allowedOutcomeCodes: outcomeCodes });
        } catch (parseErr) {
          logLifecycleError("parse_failed", { assignment: a.id, attempt, error: parseErr instanceof Error ? parseErr.message : String(parseErr) });
          if (canRetry(attempt)) continue;
          await finish("INVALID_RESPONSE", { errorMessage: "AI yanıtı JSON/şema ayrıştırma hatası." });
          return fail(502, "INVALID_RESPONSE", AI_FAILED_MESSAGE);
        }

        if (checked.ok) {
          logLifecycle("parse_success", { assignment: a.id });
          logLifecycle("validation_success", { assignment: a.id });
          break;
        } else {
          logLifecycleError("validation_failed", { assignment: a.id, attempt, issues: checked.issues.slice(0, 3).join("; ") });
          if (!canRetry(attempt)) break;
        }
      }

      if (!result || !checked || !checked.ok) {
        logLifecycleError("generation_failed", { assignment: a.id, reason: "INVALID_RESPONSE", elapsed_ms: Date.now() - startedAt });
        await finish("INVALID_RESPONSE", {
          errorMessage: checked && !checked.ok ? checked.issues.slice(0, 20).join(" | ").slice(0, 2000) : "Geçerli yanıt alınamadı.",
        });
        return fail(502, "INVALID_RESPONSE", AI_FAILED_MESSAGE);
      }

      const { content, questions } = checked.value;

      try {
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
          await tx.assignment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
        }, {
          maxWait: 10000,
          timeout: 20000,
        });
        logLifecycle("db_save_success", { assignment: a.id, questions: questions?.length ?? 0 });
      } catch (dbErr) {
        logLifecycleError("db_save_failed", { assignment: a.id, error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
        await finish("FAILED", { errorMessage: "Taslak veritabanına kaydedilemedi." });
        return fail(502, "FAILED", AI_FAILED_MESSAGE);
      }

      await finish("SUCCEEDED", { generatedAt: new Date(), inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      logLifecycle("generation_success", { assignment: a.id, total_duration_ms: Date.now() - startedAt });
      return { ok: true, data: { scope, questions: questions?.length ?? null } } as const;
    } catch (unexpected) {
      const elapsed = Date.now() - startedAt;
      const isTimeout = unexpected instanceof ProviderError && unexpected.kind === "TIMEOUT";
      const status = isTimeout ? "TIMEOUT" : "FAILED";
      logLifecycleError(isTimeout ? "generation_timeout" : "generation_failed", {
        assignment: a.id,
        total_duration_ms: elapsed,
        error: unexpected instanceof Error ? unexpected.message : String(unexpected),
      });
      await finish(status, { errorMessage: unexpected instanceof Error ? unexpected.message.slice(0, 1000) : "Beklenmeyen sunucu hatası." });
      return fail(isTimeout ? 504 : 502, status, AI_FAILED_MESSAGE);
    }
  }

  const run = async (): Promise<GenerationOutcome> => {
    let outcome: GenerationOutcome;
    try {
      outcome = await runJob();
    } catch (e) {
      await refundUsage(teacherId, "AI_CONTENT_GENERATION", lockRecord.id, db).catch(() => undefined);
      throw e;
    }
    if (outcome.ok) await commitUsage(teacherId, "AI_CONTENT_GENERATION", lockRecord.id, db).catch(() => undefined);
    else await refundUsage(teacherId, "AI_CONTENT_GENERATION", lockRecord.id, db).catch(() => undefined);
    return outcome;
  };

  return { ok: true, data: { jobId: lock.id, scope, run } } as const;
}

/** Generate and wait for the result (used by tests and scripts; the route runs phase 2 in the background). */
export async function generateStudyContent(teacherId: string, assignmentId: string, rawInput: unknown, deps: GenerateDeps = {}): Promise<GenerationOutcome> {
  const started = await startStudyContentGeneration(teacherId, assignmentId, rawInput, deps);
  if (!started.ok) return started;
  return started.data.run();
}

export type GenerationStatus =
  | {
      state: "IDLE";
      status: "IDLE";
      jobId?: undefined;
      scope?: undefined;
      generationStartedAt?: undefined;
      generationFinishedAt?: undefined;
      startedAt?: undefined;
      finishedAt?: undefined;
      message?: undefined;
      generationErrorCode?: undefined;
      reason?: undefined;
      isStaleRecovered?: undefined;
    }
  | {
      state: "GENERATING";
      status: "RUNNING";
      jobId: string;
      scope: string;
      generationStartedAt: string;
      startedAt: string;
      generationFinishedAt?: undefined;
      finishedAt?: undefined;
      message?: undefined;
      generationErrorCode?: undefined;
      reason?: undefined;
      isStaleRecovered?: undefined;
    }
  | {
      state: "SUCCESS";
      status: "SUCCEEDED";
      jobId: string;
      scope: string;
      generationStartedAt: string;
      generationFinishedAt: string | null;
      startedAt: string;
      finishedAt: string | null;
      message?: undefined;
      generationErrorCode?: undefined;
      reason?: undefined;
      isStaleRecovered?: undefined;
    }
  | {
      state: "FAILED";
      status: "FAILED";
      jobId: string;
      scope: string;
      generationStartedAt: string;
      generationFinishedAt: string | null;
      startedAt: string;
      finishedAt: string | null;
      message: string;
      generationErrorCode: string;
      reason: "TIMEOUT" | "INVALID_RESPONSE" | "FAILED";
      isStaleRecovered?: boolean;
    }
  | {
      state: "TIMEOUT";
      status: "TIMEOUT";
      jobId: string;
      scope: string;
      generationStartedAt: string;
      generationFinishedAt: string | null;
      startedAt: string;
      finishedAt: string | null;
      message: string;
      generationErrorCode: "TIMEOUT";
      reason: "TIMEOUT";
      isStaleRecovered?: boolean;
    };

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
  if (!log) return { ok: true, data: { state: "IDLE", status: "IDLE" } };

  // Stale detection & auto-recovery
  const threshold = staleThresholdMs(timeoutMs);
  const ageMs = now.getTime() - log.startedAt.getTime();
  let wasStaleRecovered = false;

  if (log.status === "RUNNING" && ageMs > threshold) {
    logLifecycle("stale_generation_recovered", { assignment: assignmentId, jobId: log.id, age_s: Math.round(ageMs / 1000) });
    try {
      log = await db.contentGenerationLog.update({
        where: { id: log.id },
        data: {
          status: "TIMEOUT",
          finishedAt: now,
          errorMessage: "İşlem süresi içinde tamamlanmadı (önceki sunucu oturumu durduruldu).",
        },
      });
      wasStaleRecovered = true;
      await refundUsage(log.teacherId, "AI_CONTENT_GENERATION", log.id, db).catch(() => undefined);
    } catch (err) {
      logLifecycleError("db_save_failed", { assignment: assignmentId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const base = {
    jobId: log.id,
    scope: log.scope,
    generationStartedAt: log.startedAt.toISOString(),
    startedAt: log.startedAt.toISOString(),
  };

  if (log.status === "RUNNING") {
    return {
      ok: true,
      data: {
        state: "GENERATING",
        status: "RUNNING",
        ...base,
      },
    };
  }

  const finishedAtStr = log.finishedAt?.toISOString() ?? null;

  if (log.status === "SUCCEEDED") {
    return {
      ok: true,
      data: {
        state: "SUCCESS",
        status: "SUCCEEDED",
        ...base,
        generationFinishedAt: finishedAtStr,
        finishedAt: finishedAtStr,
      },
    };
  }

  if (log.status === "TIMEOUT") {
    const msg = wasStaleRecovered
      ? "Önceki içerik oluşturma işlemi zaman aşımına uğradı (tamamlanamadı). Lütfen 'Tekrar Dene' ile yeniden deneyin."
      : failureMessage("TIMEOUT");
    return {
      ok: true,
      data: {
        state: "TIMEOUT",
        status: "TIMEOUT",
        ...base,
        generationFinishedAt: finishedAtStr,
        finishedAt: finishedAtStr,
        message: msg,
        generationErrorCode: "TIMEOUT",
        reason: "TIMEOUT",
        isStaleRecovered: wasStaleRecovered,
      },
    };
  }

  const reason = log.status === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "FAILED";
  return {
    ok: true,
    data: {
      state: "FAILED",
      status: "FAILED",
      ...base,
      generationFinishedAt: finishedAtStr,
      finishedAt: finishedAtStr,
      message: failureMessage(log.status),
      generationErrorCode: log.status,
      reason,
      isStaleRecovered: wasStaleRecovered,
    },
  };
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

export const QUESTIONS_LOCKED_MESSAGE =
  "Öğrenciler bu görevin sorularını çözmeye başladığı için sorular kilitlendi. Verilen cevapların anlamını korumak için soru ekleme, silme ve düzenleme yapılamaz.";

async function loadEditableQuestions(db: PrismaClient, teacherId: string, assignmentId: string) {
  const loaded = await loadOwned(db, teacherId, assignmentId);
  if (loaded.error) return loaded;
  if (loaded.assignment.archivedAt) return { error: fail(400, "ARCHIVED", "Arşivlenmiş görevin soruları değiştirilemez.") } as const;
  // Questions stay editable until the first student starts the check: after that, changing them
  // would change the meaning of answers already given.
  const started = await db.attempt.count({ where: { studentAssignment: { assignmentId } } });
  if (started > 0) return { error: fail(400, "QUESTIONS_LOCKED", QUESTIONS_LOCKED_MESSAGE) } as const;
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
      archivedAt: null,
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
    where: { status: "PUBLISHED", archivedAt: null, studyContent: { is: { status: "TEACHER_APPROVED" } }, classroom: { members: { some: { studentId } } } },
    orderBy: { deadline: "asc" },
    select: { id: true, topic: true, subject: true, deadline: true, classroom: { select: { name: true } } },
  });
}
