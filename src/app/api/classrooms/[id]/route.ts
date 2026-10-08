// PATCH /api/classrooms/[id] – edit classroom name, grade, description
// DELETE /api/classrooms/[id] – soft-archive or hard-delete classroom if empty

import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { deleteOrArchiveClassroom, updateClassroom } from "@/lib/classroom/classroom-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateClassroom(teacher.id, id, body);
  return result.ok
    ? NextResponse.json({ ok: true, data: result.data })
    : NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  const result = await deleteOrArchiveClassroom(teacher.id, id);
  return result.ok
    ? NextResponse.json({ ok: true, action: result.action, message: result.message })
    : NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
}
