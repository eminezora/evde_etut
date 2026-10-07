// PATCH  /api/assignments/:id – edit title, deadline, threshold (locked once students started), question count (drafts).
// DELETE /api/assignments/:id – delete an untouched draft, otherwise archive (student work is kept).
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { deleteOrArchiveAssignment, updateAssignment } from "@/lib/assignments/assignment-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

type Ctx = { params: Promise<{ id: string }> };

const respond = (r: { ok: true; data: unknown } | { ok: false; status: number; errors: Record<string, string[]> }) =>
  r.ok ? NextResponse.json({ ok: true, data: r.data }) : NextResponse.json({ error: Object.values(r.errors).flat()[0] ?? "İşlem yapılamadı.", errors: r.errors }, { status: r.status });

export async function PATCH(request: Request, { params }: Ctx) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  return respond(await updateAssignment(teacher.id, id, await request.json().catch(() => null)));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const { id } = await params;
  return respond(await deleteOrArchiveAssignment(teacher.id, id));
}
