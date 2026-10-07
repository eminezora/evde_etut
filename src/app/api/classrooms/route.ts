// POST /api/classrooms – a teacher creates a classroom (join code is generated on the server).
import { NextResponse } from "next/server";
import { createClassroom } from "@/lib/accounts/account-service.ts";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await createClassroom(teacher.id, await request.json().catch(() => null));
  return r.ok ? NextResponse.json({ ok: true, data: r.data }, { status: 201 }) : NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
}
