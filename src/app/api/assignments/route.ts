// POST /api/assignments – create a draft or published assignment with its MEB outcomes.
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { createAssignment } from "@/lib/assignments/assignment-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const body = await request.json().catch(() => null);
  const result = await createAssignment(teacher.id, body);
  if (!result.ok) return jsonError(result.status, "Görev kaydedilemedi.", result.errors);
  return NextResponse.json({ id: result.data.id, status: result.data.status }, { status: 201 });
}
