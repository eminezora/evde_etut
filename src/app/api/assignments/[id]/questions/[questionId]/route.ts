// PATCH / DELETE /api/assignments/:id/questions/:questionId
import { deleteQuestion, updateQuestion } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";

type Ctx = { params: Promise<{ id: string; questionId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id, questionId } = await params;
  const body = await readBody(request);
  return withTeacher((teacherId) => updateQuestion(teacherId, id, questionId, body));
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id, questionId } = await params;
  return withTeacher((teacherId) => deleteQuestion(teacherId, id, questionId));
}
