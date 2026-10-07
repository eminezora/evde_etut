// POST – start (or resume) an attempt. The attempt number is computed on the server.
import { startAttempt } from "@/lib/assessment/student-assessment-service.ts";
import { withStudent } from "@/lib/http/student-route.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(async (studentId) => {
    const r = await startAttempt(studentId, id);
    return r.ok ? { ok: true, data: { attemptId: r.data.id, attemptNumber: r.data.attemptNumber } } : r;
  }, 201);
}
