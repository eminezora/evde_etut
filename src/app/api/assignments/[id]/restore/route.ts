// POST /api/assignments/:id/restore – take an assignment out of the archive.
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { restoreAssignment } from "@/lib/assignments/assignment-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await restoreAssignment(teacher.id, (await params).id);
  if (!r.ok) return NextResponse.json({ error: Object.values(r.errors).flat()[0], errors: r.errors }, { status: r.status });
  return NextResponse.json({ ok: true, data: r.data });
}
