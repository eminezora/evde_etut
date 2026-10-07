// GET /api/curriculum/units?classroomId=…&subject=…
import { NextResponse } from "next/server";
import { getUnitsByGradeAndSubject } from "@/lib/curriculum/curriculum-service.ts";
import { jsonError, requireTeacherClassroom } from "@/lib/http/route-helpers.ts";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ctx = await requireTeacherClassroom(params.get("classroomId"));
  if ("response" in ctx) return ctx.response;
  const subject = params.get("subject");
  if (!subject) return jsonError(400, "Ders seçilmelidir.");
  return NextResponse.json({ units: await getUnitsByGradeAndSubject(ctx.classroom.grade, subject) });
}
