// GET /api/curriculum/subjects?classroomId=… – subjects for the classroom's grade (grade never comes from the client).
import { NextResponse } from "next/server";
import { getSubjectsByGrade } from "@/lib/curriculum/curriculum-service.ts";
import { requireTeacherClassroom } from "@/lib/http/route-helpers.ts";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ctx = await requireTeacherClassroom(params.get("classroomId"));
  if ("response" in ctx) return ctx.response;
  return NextResponse.json({ grade: ctx.classroom.grade, subjects: await getSubjectsByGrade(ctx.classroom.grade) });
}
