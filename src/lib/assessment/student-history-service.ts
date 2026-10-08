// Teacher views of students: a classroom's roster and one student's performance history.
// A teacher only ever sees students who are members of one of THEIR classrooms, and only the
// results of THEIR assignments in those classrooms.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";

export async function getClassroomRoster(teacherId: string, classroomId: string, db: PrismaClient = defaultPrisma) {
  const classroom = await db.classroom.findFirst({
    where: { id: classroomId, teacherId },
    select: {
      id: true,
      name: true,
      grade: true,
      joinCode: true,
      description: true,
      archivedAt: true,
      members: { orderBy: { student: { name: "asc" } }, select: { joinedAt: true, student: { select: { id: true, name: true } } } },
    },
  });
  if (!classroom) return null;
  const studentIds = classroom.members.map((m) => m.student.id);
  const sas = await db.studentAssignment.findMany({
    where: { studentId: { in: studentIds }, assignment: { classroomId, teacherId, archivedAt: null } },
    select: { studentId: true, status: true, latestScore: true },
  });
  const roster = classroom.members.map((m) => {
    const mine = sas.filter((s) => s.studentId === m.student.id);
    const scores = mine.map((s) => s.latestScore).filter((x): x is number => x !== null);
    return {
      id: m.student.id,
      name: m.student.name,
      joinedAt: m.joinedAt,
      ready: mine.filter((s) => s.status === "READY_FOR_CLASS").length,
      needsReview: mine.filter((s) => s.status === "NEEDS_REVIEW").length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  });
  return {
    classroom: {
      id: classroom.id,
      name: classroom.name,
      grade: classroom.grade,
      joinCode: classroom.joinCode,
      description: classroom.description,
      archivedAt: classroom.archivedAt,
    },
    roster,
  };
}

const DONE = ["READY_FOR_CLASS", "NEEDS_REVIEW", "PENDING_TEACHER_REVIEW"];

/** null when the student is not in any of this teacher's classrooms. */
export async function getStudentHistory(teacherId: string, studentId: string, db: PrismaClient = defaultPrisma) {
  const memberships = await db.classroomMember.findMany({
    where: { studentId, classroom: { teacherId } },
    select: { classroom: { select: { id: true, name: true, grade: true } }, student: { select: { id: true, name: true } } },
  });
  if (memberships.length === 0) return null;
  const classroomIds = memberships.map((m) => m.classroom.id);
  const assignments = await db.assignment.findMany({
    where: { teacherId, classroomId: { in: classroomIds }, status: "PUBLISHED", archivedAt: null },
    orderBy: { deadline: "desc" },
    select: {
      id: true,
      topic: true,
      subject: true,
      deadline: true,
      minimumScore: true,
      classroom: { select: { name: true } },
      studentAssignments: { where: { studentId }, select: { status: true, latestScore: true, bestScore: true, attemptCount: true, completedAt: true, updatedAt: true } },
    },
  });
  const rows = assignments.map((a) => ({ ...a, sa: a.studentAssignments[0] ?? null }));
  const scores = rows.map((r) => r.sa?.latestScore).filter((x): x is number => x !== null && x !== undefined);
  const stats = {
    total: rows.length,
    completed: rows.filter((r) => r.sa && DONE.includes(r.sa.status)).length,
    ready: rows.filter((r) => r.sa?.status === "READY_FOR_CLASS").length,
    needsReview: rows.filter((r) => r.sa?.status === "NEEDS_REVIEW").length,
    pendingReview: rows.filter((r) => r.sa?.status === "PENDING_TEACHER_REVIEW").length,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
  const recent = rows
    .filter((r) => r.sa && r.sa.status !== "NOT_STARTED")
    .sort((x, y) => y.sa!.updatedAt.getTime() - x.sa!.updatedAt.getTime())
    .slice(0, 5);
  return { student: memberships[0].student, classrooms: memberships.map((m) => m.classroom), stats, rows, recent };
}
