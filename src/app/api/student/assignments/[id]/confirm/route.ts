// POST { confirmed: true } – "Özeti okudum ve temel kavramları anladım."
import { confirmSummary } from "@/lib/assessment/student-assessment-service.ts";
import { readBody, withStudent } from "@/lib/http/student-route.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  return withStudent(async (studentId) => {
    const r = await confirmSummary(studentId, id, body);
    return r.ok ? { ok: true, data: { status: r.data.status } } : r;
  });
}
