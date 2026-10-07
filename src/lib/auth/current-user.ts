// Server-only: resolve the logged-in teacher or student from the session cookie.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "../db.ts";
import { SESSION_COOKIE, createSessionToken, readSessionToken, sessionCookieOptions } from "./session.ts";

const userSelect = { id: true, name: true, email: true, role: true, sessionVersion: true } as const;

/** The logged-in user (any role), or null. Sessions issued before a password change are rejected. */
export async function getCurrentUser() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: userSelect });
  if (!user || user.role !== session.role || user.sessionVersion !== (session.sessionVersion ?? 0)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getCurrentTeacher() {
  const user = await getCurrentUser();
  return user?.role === "TEACHER" ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function getCurrentStudent() {
  const user = await getCurrentUser();
  return user?.role === "STUDENT" ? { id: user.id, name: user.name, email: user.email } : null;
}

/** Set the session cookie for a user on a response. */
export async function setSessionCookie(res: NextResponse, user: { id: string; role: string; sessionVersion: number }) {
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: user.id, role: user.role, sessionVersion: user.sessionVersion }), sessionCookieOptions);
  return res;
}

/** The teacher's own classroom, or null (also null for another teacher's classroom). */
export async function getTeacherClassroom(teacherId: string, classroomId: string | null) {
  if (!classroomId) return null;
  return prisma.classroom.findFirst({ where: { id: classroomId, teacherId }, select: { id: true, name: true, grade: true } });
}

// Pages render in parallel with their layout, so each protected page must guard itself rather
// than rely on the layout's redirect.
export async function requireTeacher() {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/giris");
  return teacher;
}

export async function requireStudent() {
  const student = await getCurrentStudent();
  if (!student) redirect("/giris");
  return student;
}
