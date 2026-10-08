// POST /api/classrooms/[id]/restore – unarchives an archived classroom

import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { unarchiveClassroom } from "@/lib/classroom/classroom-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  const result = await unarchiveClassroom(teacher.id, id);
  return result.ok
    ? NextResponse.json({ ok: true, message: result.message, data: result.data })
    : NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
}
