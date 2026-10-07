// Shared plumbing for student route handlers.
import { NextResponse } from "next/server";
import { getCurrentStudent } from "../auth/current-user.ts";
import { jsonError } from "./route-helpers.ts";

type Result<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

export async function withStudent<T>(run: (studentId: string) => Promise<Result<T>>, okStatus = 200) {
  const student = await getCurrentStudent();
  if (!student) return jsonError(401, "Oturum açmanız gerekiyor.");
  const result = await run(student.id);
  if (!result.ok) return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, data: result.data }, { status: okStatus });
}

export const readBody = (request: Request) => request.json().catch(() => null);
