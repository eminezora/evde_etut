// Server-only: resolve the logged-in teacher or student from the session cookie.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db.ts";
import { SESSION_COOKIE, readSessionToken } from "./session.ts";

export async function getCurrentTeacher() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "TEACHER") return null;
  return prisma.user.findFirst({ where: { id: session.userId, role: "TEACHER" }, select: { id: true, name: true, email: true } });
}

export async function getCurrentStudent() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "STUDENT") return null;
  return prisma.user.findFirst({ where: { id: session.userId, role: "STUDENT" }, select: { id: true, name: true, email: true } });
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
