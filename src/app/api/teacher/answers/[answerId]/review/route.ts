// POST { awardedPoints, feedback? } – grade one open answer.
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { reviewAnswer } from "@/lib/assessment/review-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request, { params }: { params: Promise<{ answerId: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await reviewAnswer(teacher.id, (await params).answerId, await request.json().catch(() => null));
  return r.ok ? NextResponse.json({ ok: true, data: r.data }) : NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
}
