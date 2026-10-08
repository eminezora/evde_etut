// POST /api/classrooms/[id]/archive – archives an active classroom
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { archiveClassroom } from "@/lib/classroom/classroom-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  const result = await archiveClassroom(teacher.id, id);
  return result.ok
    ? NextResponse.json({ ok: true, action: result.action, message: result.message, data: result.data })
    : NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
}
