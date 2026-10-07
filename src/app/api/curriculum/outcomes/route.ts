// GET /api/curriculum/outcomes?classroomId=…&subject=…&unitOrTheme=… – VERIFIED outcomes only.
import { NextResponse } from "next/server";
import { getOutcomes } from "@/lib/curriculum/curriculum-service.ts";
import { jsonError, requireTeacherClassroom } from "@/lib/http/route-helpers.ts";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ctx = await requireTeacherClassroom(params.get("classroomId"));
  if ("response" in ctx) return ctx.response;
  const subject = params.get("subject");
  const unitOrTheme = params.get("unitOrTheme");
  if (!subject || !unitOrTheme) return jsonError(400, "Ders ve tema/ünite seçilmelidir.");
  const outcomes = await getOutcomes({ grade: ctx.classroom.grade, subject, unitOrTheme });
  return NextResponse.json({
    outcomes: outcomes.map((o) => ({ id: o.id, outcomeCode: o.outcomeCode, outcomeText: o.outcomeText, sourceUrl: o.sourceUrl })),
  });
}
