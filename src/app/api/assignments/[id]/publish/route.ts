// POST /api/assignments/:id/publish – "Onayla ve Yayınla": approves the preparation content and
// publishes the assignment in one transaction (all checks server-side).
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { approveAndPublish } from "@/lib/content/content-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const result = await approveAndPublish(teacher.id, (await params).id);
  if (!result.ok) return jsonError(result.status, "Görev yayınlanamadı.", result.errors);
  return NextResponse.json({ id: result.data.id, status: result.data.status });
}
