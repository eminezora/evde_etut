// Teacher side: grading open answers, attempt policy settings, per-assignment analytics and
// per-student detail. All functions check that the assignment belongs to the teacher.

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";
import { finalizeOrHold } from "./student-assessment-service.ts";

type Status = 400 | 403 | 404 | 409;
const fail = (status: Status, code: string, message: string) => ({ ok: false as const, status, code, message });

// ---------------------------------------------------------------------------------------------
// Pending reviews
// ---------------------------------------------------------------------------------------------

export async function listPendingReviews(teacherId: string, db: PrismaClient = defaultPrisma) {
  const answers = await db.answer.findMany({
    where: {
      reviewStatus: "PENDING_REVIEW",
      attempt: { status: "PENDING_TEACHER_REVIEW", studentAssignment: { assignment: { teacherId } } },
    },
    orderBy: [{ attempt: { submittedAt: "asc" } }, { question: { orderNum: "asc" } }],
    include: {
      question: true,
      attempt: { include: { studentAssignment: { include: { student: { select: { name: true } }, assignment: { select: { id: true, topic: true, subject: true } } } } } },
    },
  });
  return answers.map((x) => {
    const d = x.question.data as Record<string, unknown>;
    return {
      answerId: x.id,
      student: x.attempt.studentAssignment.student.name,
      studentId: x.attempt.studentAssignment.studentId,
      assignment: x.attempt.studentAssignment.assignment,
      attemptNumber: x.attempt.attemptNumber,
      submittedAt: x.attempt.submittedAt,
      question: {
        type: x.question.type,
        text: x.question.questionText,
        context: (d.context as string | undefined) ?? null,
        sampleAnswer: (d.sampleAnswer as string | undefined) ?? (d.correctAnswer as string | undefined) ?? null,
        rubric: (d.rubric as string | undefined) ?? null,
      },
      answerText: (x.answer as { text?: string } | null)?.text ?? "",
      maxPoints: x.question.points,
    };
  });
}

export const countPendingReviews = (teacherId: string, db: PrismaClient = defaultPrisma) =>
  db.answer.count({ where: { reviewStatus: "PENDING_REVIEW", attempt: { status: "PENDING_TEACHER_REVIEW", studentAssignment: { assignment: { teacherId } } } } });

const reviewSchema = z.object({
  awardedPoints: z.coerce.number({ error: "Puan sayı olmalıdır." }).min(0, "Puan 0'dan küçük olamaz."),
  feedback: z.string().trim().max(1000, "Geri bildirim en fazla 1000 karakter olabilir.").optional().default(""),
});

/** Grade one open answer; when it is the attempt's last pending answer the attempt is finalized. */
export async function reviewAnswer(teacherId: string, answerId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  return db.$transaction(async (tx) => {
    const answer = await tx.answer.findUnique({
      where: { id: answerId },
      include: { question: true, attempt: { include: { studentAssignment: { include: { assignment: { select: { teacherId: true } } } } } } },
    });
    if (!answer) return fail(404, "NOT_FOUND", "Cevap bulunamadı.");
    if (answer.attempt.studentAssignment.assignment.teacherId !== teacherId) return fail(403, "FORBIDDEN", "Bu cevap size ait bir göreve ait değil.");
    if (answer.attempt.status !== "PENDING_TEACHER_REVIEW" || !["PENDING_REVIEW", "REVIEWED"].includes(answer.reviewStatus)) {
      return fail(409, "NOT_PENDING", "Bu cevap değerlendirme beklemiyor.");
    }
    const max = answer.question.points;
    const points = Math.round(parsed.data.awardedPoints * 100) / 100;
    if (points > max) return fail(400, "VALIDATION", `Puan 0 ile ${max} arasında olmalıdır.`);
    await tx.answer.update({
      where: { id: answer.id },
      data: { awardedPoints: points, isCorrect: points >= max, reviewStatus: "REVIEWED", teacherFeedback: parsed.data.feedback || null, reviewedAt: new Date(), reviewedById: teacherId },
    });
    const remaining = await tx.answer.count({ where: { attemptId: answer.attemptId, reviewStatus: "PENDING_REVIEW" } });
    const result = remaining === 0 ? await finalizeOrHold(tx, answer.attemptId) : null;
    return { ok: true as const, data: { remaining, result } };
  });
}

// ---------------------------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------------------------

const policySchema = z.object({
  maxAttempts: z.coerce.number().int("Deneme sayısı tam sayı olmalıdır.").min(1, "En az 1 deneme olmalıdır.").max(20, "En fazla 20 deneme olabilir."),
  unlimitedAttempts: z.boolean(),
  showExplanationsAfterSubmit: z.boolean(),
  showAnswersAfterPass: z.boolean(),
});

export async function updateAssessmentPolicy(teacherId: string, assignmentId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { teacherId: true } });
  if (!a) return fail(404, "NOT_FOUND", "Görev bulunamadı.");
  if (a.teacherId !== teacherId) return fail(403, "FORBIDDEN", "Bu görev size ait değil.");
  const updated = await db.assignment.update({ where: { id: assignmentId }, data: parsed.data });
  return { ok: true as const, data: updated };
}

/** Everything about one student's work on one assignment, including all attempts and answers. */
export async function getStudentDetail(teacherId: string, assignmentId: string, studentId: string, db: PrismaClient = defaultPrisma) {
  const a = await db.assignment.findFirst({ where: { id: assignmentId, teacherId }, select: { id: true, topic: true, minimumScore: true, classroomId: true } });
  if (!a) return null;
  const member = await db.classroomMember.findUnique({ where: { classroomId_studentId: { classroomId: a.classroomId, studentId } }, include: { student: { select: { name: true } } } });
  if (!member) return null;
  const sa = await db.studentAssignment.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    include: {
      attempts: {
        orderBy: { attemptNumber: "asc" },
        include: { answers: { include: { question: { select: { questionText: true, type: true, points: true, orderNum: true, data: true } } }, orderBy: { question: { orderNum: "asc" } } } },
      },
    },
  });
  return { assignment: a, student: { id: studentId, name: member.student.name }, sa };
}
