// PUT /api/assignments/:id/content – create (manual draft) or edit the preparation content.
import { saveStudyContent } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  return withTeacher((teacherId) => saveStudyContent(teacherId, id, body));
}
