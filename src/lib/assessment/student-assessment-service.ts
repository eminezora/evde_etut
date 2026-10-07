// Student side of the pre-class readiness check ("Ön Bilgi Kontrolü"). Every function:
//  - re-checks access (member of the classroom, assignment PUBLISHED, content TEACHER_APPROVED),
//  - decides status changes itself via status-machine (never from client input),
//  - scores on the server and never returns correct answers before the policy allows it.

import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";
import { toStudentQuestion } from "../content/question-schema.ts";
import { validateAnswer, type AnswerValue } from "./answer-schema.ts";
import { computeAttemptTotals, isAutoScored, scoreQuestion } from "./scoring-service.ts";
import { EXPIRABLE, transition, type StudentStatus } from "./status-machine.ts";

type Db = PrismaClient | Prisma.TransactionClient;
type Status = 400 | 403 | 404 | 409;
export type AssessmentResult<T> = { ok: true; data: T } | { ok: false; status: Status; code: string; message: string };

const fail = (status: Status, code: string, message: string): AssessmentResult<never> => ({ ok: false, status, code, message });

/** Thrown inside transactions to roll back and return a typed failure. */
class Abort extends Error {
  constructor(readonly result: AssessmentResult<never>) {
    super(result.ok ? "" : result.message);
  }
}

export const MESSAGES = {
  notFound: "Görev bulunamadı.",
  attemptLimit: "Bu görev için izin verilen deneme sayısını tamamladın.",
  deadline: "Bu görevin son tarihi geçti; yeni deneme başlatılamaz.",
  submitDeadline: "Son tarih geçtiği için çalışma gönderilemedi. Cevapların kaydedildi ve öğretmenin görebilir.",
  confirmFirst: "Ön bilgi kontrolüne geçmeden önce özeti okuyup onaylamalısın.",
  alreadyReady: "Bu görev için zaten derse hazırsın.",
  pendingReview: "Öğretmenin açık uçlu cevaplarını değerlendirene kadar yeni deneme başlatılamaz.",
  notOpen: "Bu çalışma artık değiştirilemez.",
  pendingMessage: "Çalışmanın otomatik değerlendirilen bölümü tamamlandı. Açık uçlu cevapların öğretmenin tarafından değerlendirildikten sonra nihai sonucun oluşacak.",
} as const;

// ---------------------------------------------------------------------------------------------
// Access + lazy expiry
// ---------------------------------------------------------------------------------------------

const accessWhere = (studentId: string): Prisma.AssignmentWhereInput => ({
  status: "PUBLISHED",
  studyContent: { is: { status: "TEACHER_APPROVED" } },
  classroom: { members: { some: { studentId } } },
});

async function loadAccessibleAssignment(db: Db, studentId: string, assignmentId: string) {
  return db.assignment.findFirst({ where: { id: assignmentId, ...accessWhere(studentId) } });
}

type AccessibleAssignment = NonNullable<Awaited<ReturnType<typeof loadAccessibleAssignment>>>;
type StudentAssignmentRow = Prisma.StudentAssignmentGetPayload<object>;

const isPastDeadline = (a: { deadline: Date }, now = new Date()) => a.deadline.getTime() <= now.getTime();

/** Get or create the (assignment, student) row – unique, so concurrent first opens can't duplicate. */
async function ensureStudentAssignment(db: Db, studentId: string, assignmentId: string): Promise<StudentAssignmentRow> {
  const existing = await db.studentAssignment.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId } } });
  if (existing) return existing;
  try {
    return await db.studentAssignment.create({ data: { assignmentId, studentId, status: "NOT_STARTED" } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.studentAssignment.findUniqueOrThrow({ where: { assignmentId_studentId: { assignmentId, studentId } } });
    }
    throw e;
  }
}

/** Past the deadline: mark expirable statuses EXPIRED and close open attempts (answers are kept). */
async function expireIfNeeded(db: Db, a: AccessibleAssignment, sa: StudentAssignmentRow): Promise<StudentAssignmentRow> {
  if (!isPastDeadline(a) || !EXPIRABLE.includes(sa.status as StudentStatus)) return sa;
  await db.attempt.updateMany({ where: { studentAssignmentId: sa.id, status: "IN_PROGRESS" }, data: { status: "EXPIRED" } });
  return db.studentAssignment.update({ where: { id: sa.id }, data: { status: transition(sa.status, "EXPIRED") } });
}

async function context(db: Db, studentId: string, assignmentId: string) {
  const a = await loadAccessibleAssignment(db, studentId, assignmentId);
  if (!a) return null;
  const sa = await expireIfNeeded(db, a, await ensureStudentAssignment(db, studentId, a.id));
  return { a, sa };
}

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------

export type DashboardCategory = "UPCOMING" | "IN_PROGRESS" | "READY" | "NEEDS_REVIEW" | "EXPIRED";

export function dashboardCategory(status: string | null, deadline: Date, now = new Date()): DashboardCategory {
  const past = deadline.getTime() <= now.getTime();
  switch (status) {
    case "READY_FOR_CLASS":
      return "READY";
    case "PENDING_TEACHER_REVIEW":
      return "IN_PROGRESS";
    case "EXPIRED":
      return "EXPIRED";
    case "NEEDS_REVIEW":
      return past ? "EXPIRED" : "NEEDS_REVIEW";
    case "READING":
    case "READY_FOR_ASSESSMENT":
    case "ASSESSMENT_IN_PROGRESS":
      return past ? "EXPIRED" : "IN_PROGRESS";
    default:
      return past ? "EXPIRED" : "UPCOMING";
  }
}

export async function getStudentDashboard(studentId: string, db: PrismaClient = defaultPrisma) {
  const assignments = await db.assignment.findMany({
    where: accessWhere(studentId),
    orderBy: { deadline: "asc" },
    include: {
      classroom: { select: { name: true } },
      teacher: { select: { name: true } },
      studentAssignments: { where: { studentId } },
    },
  });
  const now = new Date();
  const cards = [];
  for (const a of assignments) {
    let sa = a.studentAssignments[0] ?? null;
    if (sa) sa = await expireIfNeeded(db, a, sa);
    const status = sa?.status ?? "NOT_STARTED";
    cards.push({
      id: a.id,
      subject: a.subject,
      topic: a.topic,
      classroom: a.classroom.name,
      teacher: a.teacher.name,
      deadline: a.deadline,
      status,
      latestScore: sa?.latestScore ?? null,
      attemptCount: sa?.attemptCount ?? 0,
      category: dashboardCategory(sa ? status : null, a.deadline, now),
    });
  }
  return cards;
}

// ---------------------------------------------------------------------------------------------
// Reading + confirmation
// ---------------------------------------------------------------------------------------------

/** First opening of the summary: summaryOpenedAt (never overwritten) and NOT_STARTED → READING. */
export async function openSummary(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const ctx = await context(db, studentId, assignmentId);
  if (!ctx) return fail(404, "NOT_FOUND", MESSAGES.notFound);
  const { sa } = ctx;
  const data: Prisma.StudentAssignmentUpdateInput = {};
  if (!sa.summaryOpenedAt) data.summaryOpenedAt = new Date();
  if (sa.status === "NOT_STARTED") data.status = transition(sa.status, "READING");
  const updated = Object.keys(data).length
    ? await db.studentAssignment.updateMany({ where: { id: sa.id, status: sa.status }, data }).then(() => db.studentAssignment.findUniqueOrThrow({ where: { id: sa.id } }))
    : sa;
  return { ok: true, data: updated } as const;
}

const confirmSchema = z.object({ confirmed: z.literal(true, { error: "Özeti okuduğunu onaylamalısın." }) });

/** "Özeti okudum ve temel kavramları anladım." – READING → READY_FOR_ASSESSMENT. */
export async function confirmSummary(studentId: string, assignmentId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const ctx = await context(db, studentId, assignmentId);
  if (!ctx) return fail(404, "NOT_FOUND", MESSAGES.notFound);
  const { sa } = ctx;
  if (sa.status === "EXPIRED") return fail(400, "EXPIRED", MESSAGES.deadline);
  if (sa.status !== "READING") {
    if (sa.summaryConfirmedAt) return { ok: true, data: sa } as const; // already confirmed – idempotent
    return fail(400, "NOT_READING", "Önce konu özetini açmalısın.");
  }
  const updated = await db.studentAssignment.update({
    where: { id: sa.id },
    data: { summaryConfirmedAt: new Date(), status: transition(sa.status, "READY_FOR_ASSESSMENT") },
  });
  return { ok: true, data: updated } as const;
}

// ---------------------------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------------------------

export function attemptPolicy(a: { maxAttempts: number; unlimitedAttempts: boolean }, attemptCount: number) {
  const remaining = a.unlimitedAttempts ? null : Math.max(0, a.maxAttempts - attemptCount);
  return { used: attemptCount, max: a.unlimitedAttempts ? null : a.maxAttempts, remaining, limitReached: remaining === 0 };
}

/** Start (or resume) an attempt. Attempt number is computed here; the client never sends it. */
export async function startAttempt(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  try {
    return await db.$transaction(async (tx) => {
      const ctx = await context(tx, studentId, assignmentId);
      if (!ctx) throw new Abort(fail(404, "NOT_FOUND", MESSAGES.notFound));
      const { a, sa } = ctx;

      const open = await tx.attempt.findFirst({ where: { studentAssignmentId: sa.id, status: "IN_PROGRESS" } });
      if (open) return { ok: true, data: open } as const; // double click / reload resumes the same attempt

      switch (sa.status) {
        case "EXPIRED":
          throw new Abort(fail(400, "DEADLINE", MESSAGES.deadline));
        case "NOT_STARTED":
        case "READING":
          throw new Abort(fail(400, "CONFIRM_FIRST", MESSAGES.confirmFirst));
        case "READY_FOR_CLASS":
          throw new Abort(fail(400, "ALREADY_READY", MESSAGES.alreadyReady));
        case "PENDING_TEACHER_REVIEW":
          throw new Abort(fail(400, "PENDING_REVIEW", MESSAGES.pendingReview));
      }
      if (!sa.summaryConfirmedAt) throw new Abort(fail(400, "CONFIRM_FIRST", MESSAGES.confirmFirst));
      if (isPastDeadline(a)) throw new Abort(fail(400, "DEADLINE", MESSAGES.deadline));

      const count = await tx.attempt.count({ where: { studentAssignmentId: sa.id } });
      if (attemptPolicy(a, count).limitReached) throw new Abort(fail(400, "ATTEMPT_LIMIT", MESSAGES.attemptLimit));

      const last = await tx.attempt.aggregate({ where: { studentAssignmentId: sa.id }, _max: { attemptNumber: true } });
      const attempt = await tx.attempt.create({
        data: { studentAssignmentId: sa.id, attemptNumber: (last._max.attemptNumber ?? 0) + 1, status: "IN_PROGRESS" },
      });
      await tx.studentAssignment.update({
        where: { id: sa.id },
        data: { status: transition(sa.status, "ASSESSMENT_IN_PROGRESS"), startedAt: sa.startedAt ?? new Date(), attemptCount: count + 1 },
      });
      return { ok: true, data: attempt } as const;
    });
  } catch (e) {
    if (e instanceof Abort) return e.result;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail(409, "CONFLICT", "Deneme zaten başlatıldı, sayfayı yenile.");
    throw e;
  }
}

const answerItem = z.object({ questionId: z.string().min(1), answer: z.unknown() });
const saveSchema = z.object({ answers: z.array(answerItem).min(1).max(20) });
const submitSchema = z.object({ answers: z.array(answerItem).max(20).default([]) });

/** Load an attempt that belongs to this student, with its assignment (access re-checked). */
async function loadOwnAttempt(db: Db, studentId: string, attemptId: string) {
  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: { studentAssignment: { include: { assignment: true } } },
  });
  if (!attempt || attempt.studentAssignment.studentId !== studentId) return null;
  const a = await loadAccessibleAssignment(db, studentId, attempt.studentAssignment.assignmentId);
  return a ? { attempt, a, sa: attempt.studentAssignment } : null;
}

async function upsertDraftAnswers(db: Db, attemptId: string, assignmentId: string, items: z.infer<typeof answerItem>[]) {
  if (new Set(items.map((i) => i.questionId)).size !== items.length) throw new Abort(fail(400, "DUPLICATE", "Aynı soru için birden fazla cevap gönderildi."));
  const questions = await db.question.findMany({ where: { assignmentId, id: { in: items.map((i) => i.questionId) } } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const item of items) {
    const q = byId.get(item.questionId);
    if (!q) throw new Abort(fail(400, "FOREIGN_QUESTION", "Bu soru bu göreve ait değil."));
    const v = validateAnswer(q, item.answer);
    if (!v.ok) throw new Abort(fail(400, "INVALID_ANSWER", v.message));
    await db.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: q.id } },
      create: { attemptId, questionId: q.id, answer: v.value as Prisma.InputJsonValue, reviewStatus: "DRAFT" },
      update: { answer: v.value as Prisma.InputJsonValue },
    });
  }
}

/** Autosave (debounced on the client). Only for the student's own open attempt before the deadline. */
export async function saveAnswers(studentId: string, attemptId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  try {
    return await db.$transaction(async (tx) => {
      const own = await loadOwnAttempt(tx, studentId, attemptId);
      if (!own) throw new Abort(fail(404, "NOT_FOUND", "Çalışma bulunamadı."));
      if (own.attempt.status !== "IN_PROGRESS") throw new Abort(fail(409, "NOT_OPEN", MESSAGES.notOpen));
      if (isPastDeadline(own.a)) throw new Abort(fail(400, "DEADLINE", MESSAGES.submitDeadline));
      await upsertDraftAnswers(tx, attemptId, own.a.id, parsed.data.answers);
      return { ok: true, data: { saved: parsed.data.answers.length } } as const;
    });
  } catch (e) {
    if (e instanceof Abort) return e.result;
    throw e;
  }
}

/** Score answers, close the attempt and move the StudentAssignment on – all in one transaction. */
export async function submitAttempt(studentId: string, attemptId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = submitSchema.safeParse(input ?? {});
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);

  // Deadline first, outside the scoring transaction, so the expiry itself is persisted.
  const pre = await loadOwnAttempt(db, studentId, attemptId);
  if (!pre) return fail(404, "NOT_FOUND", "Çalışma bulunamadı.");
  if (pre.attempt.status === "IN_PROGRESS" && isPastDeadline(pre.a)) {
    await expireIfNeeded(db, pre.a, pre.sa);
    return fail(400, "DEADLINE", MESSAGES.submitDeadline);
  }

  try {
    return await db.$transaction(async (tx) => {
      const own = await loadOwnAttempt(tx, studentId, attemptId);
      if (!own) throw new Abort(fail(404, "NOT_FOUND", "Çalışma bulunamadı."));
      // Claim the attempt: only one submit can move it out of IN_PROGRESS (double-submit guard).
      const claimed = await tx.attempt.updateMany({ where: { id: attemptId, status: "IN_PROGRESS" }, data: { status: "SUBMITTING", submittedAt: new Date() } });
      if (claimed.count !== 1) throw new Abort(fail(409, "NOT_OPEN", MESSAGES.notOpen));

      if (parsed.data.answers.length) await upsertDraftAnswers(tx, attemptId, own.a.id, parsed.data.answers);

      const questions = await tx.question.findMany({ where: { assignmentId: own.a.id }, orderBy: { orderNum: "asc" } });
      const saved = await tx.answer.findMany({ where: { attemptId } });
      const byQuestion = new Map(saved.map((s) => [s.questionId, s]));
      for (const q of questions) {
        const value = (byQuestion.get(q.id)?.answer ?? null) as AnswerValue | null;
        const s = scoreQuestion(q, value);
        await tx.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: q.id } },
          create: { attemptId, questionId: q.id, answer: value ? (value as Prisma.InputJsonValue) : Prisma.JsonNull, reviewStatus: s.reviewStatus, isCorrect: s.isCorrect, awardedPoints: s.awardedPoints },
          update: { reviewStatus: s.reviewStatus, isCorrect: s.isCorrect, awardedPoints: s.awardedPoints },
        });
      }
      const result = await finalizeOrHold(tx, attemptId);
      return { ok: true, data: result } as const;
    });
  } catch (e) {
    if (e instanceof Abort) return e.result;
    throw e;
  }
}

/**
 * Recompute an attempt from its answers. With answers awaiting review the attempt (and the
 * StudentAssignment) wait for the teacher; otherwise the final score decides READY_FOR_CLASS vs
 * NEEDS_REVIEW against assignment.minimumScore. Shared with the teacher review flow.
 */
export async function finalizeOrHold(tx: Db, attemptId: string) {
  const attempt = await tx.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { studentAssignment: { include: { assignment: true } }, answers: { include: { question: true } } },
  });
  const totals = computeAttemptTotals(
    attempt.answers.map((x) => ({
      points: x.question.points,
      auto: isAutoScored(x.question.type, x.question.data),
      reviewStatus: x.reviewStatus,
      awardedPoints: x.awardedPoints,
      isCorrect: x.isCorrect,
    })),
  );
  const sa = attempt.studentAssignment;
  const base = {
    autoScore: totals.autoScore,
    manualScore: totals.manualScore,
    earnedPoints: totals.earnedPoints,
    totalPoints: totals.totalPoints,
    correctCount: totals.correctCount,
    incorrectCount: totals.incorrectCount,
  };

  if (totals.finalScore === null) {
    await tx.attempt.update({ where: { id: attemptId }, data: { ...base, status: "PENDING_TEACHER_REVIEW", requiresTeacherReview: true } });
    if (sa.status !== "PENDING_TEACHER_REVIEW") {
      await tx.studentAssignment.update({ where: { id: sa.id }, data: { status: transition(sa.status, "PENDING_TEACHER_REVIEW") } });
    }
    return { status: "PENDING_TEACHER_REVIEW" as const, finalScore: null, autoScore: totals.autoScore };
  }

  const finalScore = totals.finalScore;
  const passed = finalScore >= sa.assignment.minimumScore;
  const next = passed ? "READY_FOR_CLASS" : "NEEDS_REVIEW";
  const now = new Date();
  await tx.attempt.update({ where: { id: attemptId }, data: { ...base, finalScore, status: "COMPLETED", finalizedAt: now } });
  await tx.studentAssignment.update({
    where: { id: sa.id },
    data: {
      status: transition(sa.status, next),
      latestScore: finalScore,
      bestScore: Math.max(finalScore, sa.bestScore ?? 0),
      ...(passed ? { completedAt: now } : {}),
    },
  });
  return { status: next, finalScore, autoScore: totals.autoScore };
}

// ---------------------------------------------------------------------------------------------
// Read models for the student UI (never include correct answers before the policy allows)
// ---------------------------------------------------------------------------------------------

export async function getStudentOverview(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const ctx = await context(db, studentId, assignmentId);
  if (!ctx) return null;
  const a = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      classroom: { select: { name: true } },
      teacher: { select: { name: true } },
      studyContent: true,
      assignmentOutcomes: { include: { outcome: { select: { outcomeCode: true, outcomeText: true } } } },
      _count: { select: { questions: true } },
    },
  });
  const c = a.studyContent!;
  return {
    sa: ctx.sa,
    assignment: {
      id: a.id,
      topic: a.topic,
      subject: a.subject,
      grade: a.grade,
      unitOrTheme: a.unitOrTheme,
      classroom: a.classroom.name,
      teacher: a.teacher.name,
      deadline: a.deadline,
      minimumScore: a.minimumScore,
      questionCount: a._count.questions,
      outcomes: a.assignmentOutcomes.map((x) => x.outcome),
      policy: attemptPolicy(a, ctx.sa.attemptCount),
    },
    content: {
      introduction: c.introduction,
      keyConcepts: c.keyConcepts as { term: string; explanation: string }[],
      summary: c.summary,
      simpleExample: c.simpleExample,
      mustKnow: c.mustKnow as string[],
    },
  };
}

/** Open attempt + questions (student view) + the student's saved answers. */
export async function getAssessmentView(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const ctx = await context(db, studentId, assignmentId);
  if (!ctx) return null;
  const attempt = await db.attempt.findFirst({ where: { studentAssignmentId: ctx.sa.id, status: "IN_PROGRESS" }, include: { answers: true } });
  const questions = await db.question.findMany({ where: { assignmentId }, orderBy: { orderNum: "asc" } });
  return {
    sa: ctx.sa,
    deadline: ctx.a.deadline,
    policy: attemptPolicy(ctx.a, ctx.sa.attemptCount),
    attempt: attempt && {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      answers: Object.fromEntries(attempt.answers.map((x) => [x.questionId, x.answer as AnswerValue | null])),
    },
    questions: questions.map(toStudentQuestion),
  };
}

/** Attempt detail for its owner only (API: GET /api/student/attempts/:id). No correct answers. */
export async function getOwnAttempt(studentId: string, attemptId: string, db: PrismaClient = defaultPrisma) {
  const own = await loadOwnAttempt(db, studentId, attemptId);
  if (!own) return null;
  const answers = await db.answer.findMany({ where: { attemptId }, select: { questionId: true, answer: true, reviewStatus: true } });
  const { attempt } = own;
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    finalScore: attempt.status === "COMPLETED" ? attempt.finalScore : null,
    answers,
  };
}

const hiddenUntil = (status: string, policy: { showExplanationsAfterSubmit: boolean; showAnswersAfterPass: boolean }) => ({
  correctness: policy.showExplanationsAfterSubmit || status === "READY_FOR_CLASS",
  explanations: policy.showExplanationsAfterSubmit || (status === "READY_FOR_CLASS" && policy.showAnswersAfterPass),
  answers: status === "READY_FOR_CLASS" && policy.showAnswersAfterPass,
});

function correctAnswerText(type: string, data: Record<string, unknown>): string | null {
  switch (type) {
    case "MULTIPLE_CHOICE":
      return String(data.correctAnswer);
    case "CONTEXT_BASED":
      return data.options ? String(data.correctAnswer) : null;
    case "TRUE_FALSE":
      return data.correctAnswer ? "Doğru" : "Yanlış";
    case "FILL_IN_THE_BLANK":
      return String(data.correctAnswer);
    case "MATCHING":
      return (data.pairs as { left: string; right: string }[]).map((p) => `${p.left} → ${p.right}`).join("; ");
    case "ORDERING":
      return (data.correctOrder as number[]).map((i) => (data.items as string[])[i]).join(" → ");
    default:
      return null;
  }
}

/** Result of the latest submitted attempt, with feedback according to the assignment policy. */
export async function getResultView(studentId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const ctx = await context(db, studentId, assignmentId);
  if (!ctx) return null;
  const { a, sa } = ctx;
  const attempt = await db.attempt.findFirst({
    where: { studentAssignmentId: sa.id, status: { in: ["COMPLETED", "PENDING_TEACHER_REVIEW"] } },
    orderBy: { attemptNumber: "desc" },
    include: { answers: { include: { question: { include: { outcomes: { include: { outcome: true } } } } }, orderBy: { question: { orderNum: "asc" } } } },
  });
  if (!attempt) return { sa, attempt: null, minimumScore: a.minimumScore, policy: attemptPolicy(a, sa.attemptCount) };

  const show = hiddenUntil(sa.status, a);
  const pending = attempt.status === "PENDING_TEACHER_REVIEW";
  const content = await db.studyContent.findUniqueOrThrow({ where: { assignmentId } });
  const concepts = content.keyConcepts as { term: string; explanation: string }[];

  // Revision suggestions from the outcomes of questions that did not get full points.
  const missed = attempt.answers.filter((x) => x.awardedPoints !== null && x.awardedPoints < x.question.points);
  const outcomeMap = new Map<string, { code: string; text: string }>();
  for (const x of missed) for (const o of x.question.outcomes) outcomeMap.set(o.outcome.outcomeCode, { code: o.outcome.outcomeCode, text: o.outcome.outcomeText });
  const haystack = missed.map((x) => `${x.question.questionText} ${x.question.outcomes.map((o) => o.outcome.outcomeText).join(" ")}`).join(" ").toLocaleLowerCase("tr-TR");
  const conceptHits = concepts.filter((k) => k.term.trim().length > 1 && haystack.includes(k.term.toLocaleLowerCase("tr-TR")));

  return {
    sa,
    minimumScore: a.minimumScore,
    policy: attemptPolicy(a, sa.attemptCount),
    attempt: {
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      pending,
      // Provisional auto score is never presented as the final result.
      finalScore: pending ? null : attempt.finalScore,
      correctCount: attempt.correctCount ?? 0,
      incorrectCount: attempt.incorrectCount ?? 0,
      pendingCount: attempt.answers.filter((x) => x.reviewStatus === "PENDING_REVIEW").length,
      questions: attempt.answers.map((x) => ({
        questionText: x.question.questionText,
        type: x.question.type,
        points: x.question.points,
        reviewStatus: x.reviewStatus,
        isCorrect: show.correctness && x.reviewStatus !== "PENDING_REVIEW" ? x.isCorrect : null,
        awardedPoints: show.correctness && x.reviewStatus !== "PENDING_REVIEW" ? x.awardedPoints : null,
        explanation: show.explanations ? x.question.explanation : null,
        correctAnswer: show.answers ? correctAnswerText(x.question.type, x.question.data as Record<string, unknown>) : null,
        teacherFeedback: x.teacherFeedback,
      })),
    },
    recommendations: pending || sa.status === "READY_FOR_CLASS" ? null : { outcomes: [...outcomeMap.values()], concepts: conceptHits },
  };
}
