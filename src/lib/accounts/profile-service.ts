// Profile / account settings data for teachers and students, and the name update.
// Every query is scoped to the signed-in user's own id.

import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";

const accountSelect = { id: true, name: true, email: true, role: true, createdAt: true, avatarUrl: true, passwordHash: true, googleSub: true } as const;

async function account(db: PrismaClient, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: accountSelect });
  if (!u) return null;
  const { passwordHash, googleSub, ...rest } = u;
  return { ...rest, hasPassword: Boolean(passwordHash), googleLinked: Boolean(googleSub) };
}

export async function getTeacherProfile(teacherId: string, db: PrismaClient = defaultPrisma, now = new Date()) {
  const user = await account(db, teacherId);
  if (!user || user.role !== "TEACHER") return null;
  const classrooms = await db.classroom.findMany({
    where: { teacherId },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, joinCode: true, _count: { select: { members: true } } },
  });
  const students = await db.classroomMember.findMany({ where: { classroom: { teacherId } }, distinct: ["studentId"], select: { studentId: true } });
  const [activeAssignments, draftAssignments] = await Promise.all([
    db.assignment.count({ where: { teacherId, status: "PUBLISHED", archivedAt: null, deadline: { gt: now } } }),
    db.assignment.count({ where: { teacherId, status: "DRAFT", archivedAt: null } }),
  ]);
  return { user, classrooms, stats: { classrooms: classrooms.length, students: students.length, activeAssignments, draftAssignments } };
}

const DONE = ["READY_FOR_CLASS", "NEEDS_REVIEW", "PENDING_TEACHER_REVIEW"];

export async function getStudentProfile(studentId: string, db: PrismaClient = defaultPrisma, now = new Date()) {
  const user = await account(db, studentId);
  if (!user || user.role !== "STUDENT") return null;
  const classrooms = await db.classroom.findMany({
    where: { members: { some: { studentId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, grade: true, teacher: { select: { name: true } } },
  });
  // Published, non-archived assignments of the student's classrooms with the student's own progress.
  const assignments = await db.assignment.findMany({
    where: { status: "PUBLISHED", archivedAt: null, classroom: { members: { some: { studentId } } } },
    select: { deadline: true, studentAssignments: { where: { studentId }, select: { status: true } } },
  });
  let completed = 0;
  let ready = 0;
  let pending = 0;
  for (const a of assignments) {
    const status = a.studentAssignments[0]?.status ?? "NOT_STARTED";
    if (DONE.includes(status)) completed++;
    if (status === "READY_FOR_CLASS") ready++;
    if (!DONE.includes(status) && status !== "EXPIRED" && a.deadline > now) pending++;
  }
  return { user, classrooms, stats: { total: assignments.length, completed, ready, pending } };
}

const nameSchema = z.object({ name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalıdır.").max(80, "Ad soyad en fazla 80 karakter olabilir.") });

export async function updateProfileName(userId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: parsed.error.issues[0].message };
  const user = await db.user.update({ where: { id: userId }, data: { name: parsed.data.name }, select: { id: true, name: true } });
  return { ok: true as const, data: user };
}
