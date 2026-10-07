// PATCH – attempt limit and feedback policy (teacher may change it after publishing).
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { updateAssessmentPolicy } from "@/lib/assessment/review-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await updateAssessmentPolicy(teacher.id, (await params).id, await request.json().catch(() => null));
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
}
