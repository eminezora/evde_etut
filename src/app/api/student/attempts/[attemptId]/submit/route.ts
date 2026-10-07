// POST { answers?: [...] } – submit; the server scores and decides the status.
import { submitAttempt } from "@/lib/assessment/student-assessment-service.ts";
import { readBody, withStudent } from "@/lib/http/student-route.ts";

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const body = await readBody(request);
  return withStudent((studentId) => submitAttempt(studentId, attemptId, body));
}
