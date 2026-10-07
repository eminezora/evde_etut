// GET – the student's own attempt (no correct answers).
import { NextResponse } from "next/server";
import { getCurrentStudent } from "@/lib/auth/current-user.ts";
import { getOwnAttempt } from "@/lib/assessment/student-assessment-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return jsonError(401, "Oturum açmanız gerekiyor.");
  const attempt = await getOwnAttempt(student.id, (await params).attemptId);
  return attempt ? NextResponse.json({ ok: true, data: attempt }) : jsonError(404, "Çalışma bulunamadı.");
}
