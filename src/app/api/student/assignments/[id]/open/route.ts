// POST – the student opened the summary (sets summaryOpenedAt once; NOT_STARTED → READING).
import { openSummary } from "@/lib/assessment/student-assessment-service.ts";
import { withStudent } from "@/lib/http/student-route.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withStudent(async (studentId) => {
    const r = await openSummary(studentId, id);
    return r.ok ? { ok: true, data: { status: r.data.status } } : r;
  });
}
