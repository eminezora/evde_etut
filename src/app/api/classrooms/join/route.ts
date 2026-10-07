// POST /api/classrooms/join { code } – a student joins a classroom.
import { NextResponse } from "next/server";
import { joinClassroom } from "@/lib/accounts/account-service.ts";
import { getCurrentStudent } from "@/lib/auth/current-user.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request) {
  const student = await getCurrentStudent();
  if (!student) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await joinClassroom(student.id, await request.json().catch(() => null));
  return r.ok ? NextResponse.json({ ok: true, data: r.data }) : NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
}
