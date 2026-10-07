// Small helpers shared by route handlers.
import { NextResponse } from "next/server";
import { getCurrentTeacher, getTeacherClassroom } from "../auth/current-user.ts";

export const jsonError = (status: number, message: string, errors?: Record<string, string[]>) =>
  NextResponse.json({ error: message, errors: errors ?? { _form: [message] } }, { status });

/** Resolve the logged-in teacher and (optionally) one of their classrooms from ?classroomId=. */
export async function requireTeacherClassroom(classroomId: string | null) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return { response: jsonError(401, "Oturum açmanız gerekiyor.") } as const;
  const classroom = await getTeacherClassroom(teacher.id, classroomId);
  if (!classroom) return { response: jsonError(404, "Sınıf bulunamadı.") } as const;
  return { teacher, classroom } as const;
}
