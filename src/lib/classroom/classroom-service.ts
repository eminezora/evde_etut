// Classroom management service: updating details, regenerating join codes,
// soft-deleting/archiving vs. hard-deleting, and unarchiving.
// Only the owning teacher (or an admin) can manage a classroom.

import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";

type Status = 400 | 403 | 404 | 409;
const fail = (status: Status, code: string, message: string) => ({ ok: false as const, status, code, message });

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newJoinCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const normalizeJoinCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const updateClassroomSchema = z.object({
  name: z.string().trim().min(1, "Sınıf adı boş olamaz.").max(40, "Sınıf adı en fazla 40 karakter olabilir.").optional(),
  grade: z.coerce.number().int().min(5, "Sınıf düzeyi 5–8 arasında olmalıdır.").max(8, "Sınıf düzeyi 5–8 arasında olmalıdır.").optional(),
  description: z.string().trim().max(300, "Açıklama en fazla 300 karakter olabilir.").optional().nullable(),
});

export async function updateClassroom(
  teacherId: string,
  classroomId: string,
  input: unknown,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const parsed = updateClassroomSchema.safeParse(input);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0].message);

  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true, grade: true, name: true, description: true },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfı düzenleme yetkiniz bulunmuyor.");
  }

  // Grade change safety: check if existing assignments conflict
  if (parsed.data.grade !== undefined && parsed.data.grade !== classroom.grade) {
    const existingAssignmentsCount = await db.assignment.count({
      where: { classroomId },
    });
    if (existingAssignmentsCount > 0) {
      return fail(
        400,
        "GRADE_CONFLICT",
        `Bu sınıfa atanmış ${existingAssignmentsCount} adet görev bulunmaktadır. Mevcut görevlerin müfredat bütünlüğünü korumak için sınıf kademesi değiştirilemez.`
      );
    }
  }

  const updated = await db.classroom.update({
    where: { id: classroomId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.grade !== undefined ? { grade: parsed.data.grade } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
    },
    select: { id: true, name: true, grade: true, description: true, joinCode: true, archivedAt: true },
  });

  return { ok: true as const, data: updated };
}

export async function regenerateClassroomJoinCode(
  teacherId: string,
  classroomId: string,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfın kodunu yenileme yetkiniz bulunmuyor.");
  }

  for (let i = 0; i < 5; i++) {
    try {
      const joinCode = newJoinCode();
      const updated = await db.classroom.update({
        where: { id: classroomId },
        data: { joinCode },
        select: { id: true, joinCode: true },
      });
      return { ok: true as const, data: updated };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }

  return fail(409, "CODE_COLLISION", "Yeni katılma kodu oluşturulamadı, lütfen tekrar deneyin.");
}

export async function hardDeleteClassroom(
  teacherId: string,
  classroomId: string,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: {
      id: true,
      teacherId: true,
      _count: {
        select: {
          members: true,
          assignments: true,
        },
      },
    },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfı silme yetkiniz bulunmuyor.");
  }

  const hasMembers = classroom._count.members > 0;
  const hasAssignments = classroom._count.assignments > 0;

  if (hasMembers || hasAssignments) {
    return fail(
      400,
      "HAS_DATA",
      "Bu sınıfta öğrenci veya geçmiş çalışma verileri bulunduğu için kalıcı olarak silinemez. Arşivleyebilirsiniz."
    );
  }

  await db.classroom.delete({ where: { id: classroomId } });
  return { ok: true as const, action: "DELETED" as const, message: "Sınıf kalıcı olarak silindi." };
}

export async function archiveClassroom(
  teacherId: string,
  classroomId: string,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true, archivedAt: true },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfı arşivleme yetkiniz bulunmuyor.");
  }

  const updated = await db.classroom.update({
    where: { id: classroomId },
    data: { archivedAt: new Date() },
    select: { id: true, archivedAt: true },
  });

  return {
    ok: true as const,
    action: "ARCHIVED" as const,
    message: "Sınıfta kayıtlı öğrenciler veya görevler bulunduğu için sınıf arşivlendi. Öğrenci geçmişleri ve raporlar korunacaktır.",
    data: updated,
  };
}

export async function deleteOrArchiveClassroom(
  teacherId: string,
  classroomId: string,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: {
      id: true,
      teacherId: true,
      archivedAt: true,
      _count: {
        select: {
          members: true,
          assignments: true,
        },
      },
    },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfı silme veya arşivleme yetkiniz bulunmuyor.");
  }

  const hasMembers = classroom._count.members > 0;
  const hasAssignments = classroom._count.assignments > 0;

  if (!hasMembers && !hasAssignments) {
    return hardDeleteClassroom(teacherId, classroomId, db, isAdmin);
  }

  return archiveClassroom(teacherId, classroomId, db, isAdmin);
}

export async function unarchiveClassroom(
  teacherId: string,
  classroomId: string,
  db: PrismaClient = defaultPrisma,
  isAdmin = false
) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, teacherId: true, archivedAt: true },
  });

  if (!classroom) return fail(404, "NOT_FOUND", "Sınıf bulunamadı.");
  if (!isAdmin && classroom.teacherId !== teacherId) {
    return fail(403, "FORBIDDEN", "Bu sınıfı arşivden çıkarma yetkiniz bulunmuyor.");
  }

  const updated = await db.classroom.update({
    where: { id: classroomId },
    data: { archivedAt: null },
    select: { id: true, archivedAt: true },
  });

  return { ok: true as const, message: "Sınıf tekrar aktif hale getirildi.", data: updated };
}
