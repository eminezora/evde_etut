// PUT { answers: [{ questionId, answer }] } – autosave draft answers of an open attempt.
import { saveAnswers } from "@/lib/assessment/student-assessment-service.ts";
import { readBody, withStudent } from "@/lib/http/student-route.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const body = await readBody(request);
  return withStudent((studentId) => saveAnswers(studentId, attemptId, body));
}
