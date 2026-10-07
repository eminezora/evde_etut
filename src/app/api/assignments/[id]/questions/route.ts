// POST /api/assignments/:id/questions – add a question manually.
import { addQuestion } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  return withTeacher((teacherId) => addQuestion(teacherId, id, body), 201);
}
