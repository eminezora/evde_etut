// POST /api/assignments/:id/questions/:questionId/move – { direction: "up" | "down" }
import { moveQuestion } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const { id, questionId } = await params;
  const body = await readBody(request);
  return withTeacher((teacherId) => moveQuestion(teacherId, id, questionId, body?.direction));
}
