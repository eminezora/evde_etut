// Server-side assignment creation (always DRAFT; publishing lives in content-service). Never trusts grade/subject/unit sent by the client:
// grade comes from the teacher's own classroom, and every outcome id is re-loaded from the DB and
// checked to be VERIFIED and to belong to that grade, the chosen subject and the chosen theme/unit.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";
import { SELECTABLE_STATUS } from "../curriculum/curriculum-service.ts";
import { createAssignmentSchema, fieldErrors } from "./assignment-schema.ts";

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

export async function listAssignmentsForTeacher(teacherId: string, db: PrismaClient = defaultPrisma) {
  return db.assignment.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    include: { classroom: { select: { name: true } }, _count: { select: { assignmentOutcomes: true } } },
  });
}
