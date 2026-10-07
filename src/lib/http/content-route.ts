// Shared plumbing for the teacher content/question route handlers.
import { NextResponse } from "next/server";
import { getCurrentTeacher } from "../auth/current-user.ts";
import type { ContentResult } from "../content/content-service.ts";
import { jsonError } from "./route-helpers.ts";

export async function withTeacher<T>(run: (teacherId: string) => Promise<ContentResult<T>>, okStatus = 200) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const result = await run(teacher.id);
  if (!result.ok) {
    const first = Object.values(result.errors).flat()[0] ?? "İşlem yapılamadı.";
    return NextResponse.json({ error: first, code: result.code, errors: result.errors }, { status: result.status });
  }
  return NextResponse.json({ ok: true, data: result.data }, { status: okStatus });
}

export const readBody = (request: Request) => request.json().catch(() => null);
