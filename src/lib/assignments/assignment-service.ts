// Server-side assignment creation (always DRAFT; publishing lives in content-service). Never trusts grade/subject/unit sent by the client:
// grade comes from the teacher's own classroom, and every outcome id is re-loaded from the DB and
// checked to be VERIFIED and to belong to that grade, the chosen subject and the chosen theme/unit.

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";
import { SELECTABLE_STATUS } from "../curriculum/curriculum-service.ts";
import { createAssignmentSchema, fieldErrors } from "./assignment-schema.ts";
import { questionCountSchema } from "../content/study-content-schema.ts";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404; errors: Record<string, string[]> };

const fail = (status: 400 | 403 | 404, field: string, message: string): ServiceResult<never> => ({
  ok: false,
  status,
  errors: { [field]: [message] },
});

export async function createAssignment(teacherId: string, rawInput: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = createAssignmentSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, status: 400, errors: fieldErrors(parsed.error) } as const;
  const input = parsed.data;

  // Classroom must exist and belong to this teacher; its grade bounds the curriculum.
  const classroom = await db.classroom.findUnique({ where: { id: input.classroomId } });
  if (!classroom) return fail(404, "classroomId", "Sınıf bulunamadı.");
  if (classroom.teacherId !== teacherId) return fail(403, "classroomId", "Bu sınıf size ait değil.");

  // Re-load every outcome from the DB (including non-VERIFIED ones, to give a precise error).
  const outcomes = await db.curriculumOutcome.findMany({
    where: { id: { in: input.outcomeIds } },
    select: { id: true, grade: true, subject: true, reviewStatus: true, outcomeCode: true, units: { select: { unitOrTheme: true } } },
  });
  const byId = new Map(outcomes.map((o) => [o.id, o]));
  const errors: string[] = [];
  for (const id of input.outcomeIds) {
    const o = byId.get(id);
    if (!o) {
      errors.push(`Öğrenme çıktısı bulunamadı (${id}).`);
      continue;
    }
    if (o.reviewStatus !== SELECTABLE_STATUS) errors.push(`${o.outcomeCode} doğrulanmış (VERIFIED) bir öğrenme çıktısı değil.`);
    if (o.grade !== classroom.grade) errors.push(`${o.outcomeCode} ${o.grade}. sınıfa ait; sınıfınız ${classroom.grade}. sınıf.`);
    if (o.subject !== input.subject) errors.push(`${o.outcomeCode} "${input.subject}" dersine ait değil.`);
    if (!o.units.some((u) => u.unitOrTheme === input.unitOrTheme)) errors.push(`${o.outcomeCode} seçilen tema/üniteye ait değil.`);
  }
  if (errors.length) return { ok: false, status: 400, errors: { outcomeIds: errors } } as const;

  // Subject/theme must exist for this grade in the curriculum even for a draft without outcomes.
  const unitExists = await db.curriculumOutcomeUnit.count({
    where: { grade: classroom.grade, subject: input.subject, unitOrTheme: input.unitOrTheme, outcome: { reviewStatus: SELECTABLE_STATUS } },
  });
  if (!unitExists) return fail(400, "unitOrTheme", "Seçilen ders/tema bu sınıf düzeyinin müfredatında yok.");

  const assignment = await db.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        teacherId,
        classroomId: classroom.id,
        grade: classroom.grade,
        subject: input.subject,
        unitOrTheme: input.unitOrTheme,
        topic: input.topic,
        minimumScore: input.minimumScore,
        deadline: input.deadline,
        questionCount: input.questionCount,
        status: "DRAFT",
      },
    });
    if (input.outcomeIds.length) {
      await tx.assignmentOutcome.createMany({ data: input.outcomeIds.map((outcomeId) => ({ assignmentId: created.id, outcomeId })) });
    }
    return created;
  }, {
    maxWait: 10000,
    timeout: 20000,
  });
  return { ok: true, data: assignment } as const;
}

export async function getAssignmentForTeacher(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  return db.assignment.findFirst({
    where: { id: assignmentId, teacherId },
    include: {
      classroom: { select: { name: true, grade: true } },
      assignmentOutcomes: {
        include: { outcome: { select: { id: true, outcomeCode: true, outcomeText: true, sourceUrl: true } } },
        orderBy: { outcome: { outcomeCode: "asc" } },
      },
    },
  });
}

export async function listAssignmentsForTeacher(teacherId: string, db: PrismaClient = defaultPrisma, { archived = false }: { archived?: boolean } = {}) {
  return db.assignment.findMany({
    where: { teacherId, archivedAt: archived ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    include: { classroom: { select: { name: true } }, _count: { select: { assignmentOutcomes: true } } },
  });
}

// ---------------------------------------------------------------------------------------------
// Editing, archiving, deleting
// ---------------------------------------------------------------------------------------------

export const MIN_SCORE_LOCKED_MESSAGE =
  "Öğrenciler bu görevde ön bilgi kontrolünü çözmeye başladığı için başarı eşiği değiştirilemez; aksi hâlde verilmiş “Derse Hazır / Tekrar Gerekli” sonuçları tutarsız olur.";
export const QUESTION_COUNT_LOCKED_MESSAGE = "Soru sayısı yalnızca taslak görevlerde (yapay zekâ taslağı için) değiştirilebilir.";

/** What may still change: questions/threshold lock once a student has started the check. */
export async function getEditState(assignmentId: string, db: PrismaClient = defaultPrisma) {
  const [attempts, students] = await Promise.all([
    db.attempt.count({ where: { studentAssignment: { assignmentId } } }),
    db.studentAssignment.count({ where: { assignmentId } }),
  ]);
  return { started: attempts > 0, attempts, studentsOpened: students };
}

const updateSchema = z.object({
  topic: z.string().trim().min(1, "Görev başlığı girilmelidir.").max(200, "Görev başlığı en fazla 200 karakter olabilir."),
  minimumScore: z.coerce.number({ error: "Başarı eşiği sayı olmalıdır." }).int("Başarı eşiği tam sayı olmalıdır.").min(0, "Başarı eşiği 0–100 arasında olmalıdır.").max(100, "Başarı eşiği 0–100 arasında olmalıdır."),
  deadline: z.coerce.date({ error: "Geçerli bir son tarih girilmelidir." }),
  questionCount: questionCountSchema.optional(),
});

/**
 * Edit an assignment's details. Draft and not-yet-started assignments can change everything here;
 * once a student has started the check the success threshold is locked (and the question count only
 * ever matters for drafts). Questions themselves are guarded in content-service.
 */
export async function updateAssignment(teacherId: string, assignmentId: string, rawInput: unknown, db: PrismaClient = defaultPrisma, now = new Date()) {
  const parsed = updateSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, status: 400, errors: fieldErrors(parsed.error) } as const;
  const a = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!a) return fail(404, "_form", "Görev bulunamadı.");
  if (a.teacherId !== teacherId) return fail(403, "_form", "Bu görev size ait değil.");
  if (a.archivedAt) return fail(400, "_form", "Arşivlenmiş görev düzenlenemez. Önce arşivden çıkarın.");
  const input = parsed.data;
  if (Number.isNaN(input.deadline.getTime()) || input.deadline.getTime() <= now.getTime()) return fail(400, "deadline", "Son tarih gelecekte olmalıdır.");

  const { started } = await getEditState(a.id, db);
  if (started && input.minimumScore !== a.minimumScore) return fail(400, "minimumScore", MIN_SCORE_LOCKED_MESSAGE);
  if (input.questionCount !== undefined && input.questionCount !== a.questionCount && a.status !== "DRAFT") return fail(400, "questionCount", QUESTION_COUNT_LOCKED_MESSAGE);

  const updated = await db.assignment.update({
    where: { id: a.id },
    data: { topic: input.topic, minimumScore: input.minimumScore, deadline: input.deadline, ...(input.questionCount !== undefined ? { questionCount: input.questionCount } : {}) },
  });
  return { ok: true, data: updated } as const;
}

/**
 * "Görevi Sil": a draft nobody has opened is deleted for real. Anything students have seen or
 * worked on is archived instead (hidden from lists, every attempt, answer and report kept).
 */
export async function deleteOrArchiveAssignment(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma, now = new Date()) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, teacherId: true, status: true, archivedAt: true } });
  if (!a) return fail(404, "_form", "Görev bulunamadı.");
  if (a.teacherId !== teacherId) return fail(403, "_form", "Bu görev size ait değil.");
  const studentRows = await db.studentAssignment.count({ where: { assignmentId: a.id } });
  if (a.status === "DRAFT" && studentRows === 0) {
    await db.assignment.delete({ where: { id: a.id } });
    return { ok: true, data: { action: "DELETED" as const } } as const;
  }
  if (!a.archivedAt) await db.assignment.update({ where: { id: a.id }, data: { archivedAt: now } });
  return { ok: true, data: { action: "ARCHIVED" as const } } as const;
}

export async function restoreAssignment(teacherId: string, assignmentId: string, db: PrismaClient = defaultPrisma) {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, teacherId: true } });
  if (!a) return fail(404, "_form", "Görev bulunamadı.");
  if (a.teacherId !== teacherId) return fail(403, "_form", "Bu görev size ait değil.");
  await db.assignment.update({ where: { id: a.id }, data: { archivedAt: null } });
  return { ok: true, data: { action: "RESTORED" as const } } as const;
}
