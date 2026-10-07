// POST /api/assignments/:id/content/generate – AI draft for { scope: ALL | SUMMARY | QUESTIONS }.
// The result is always saved as AI_GENERATED_DRAFT; it is never published automatically.
import { generateStudyContent } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  return withTeacher((teacherId) => generateStudyContent(teacherId, id, body));
}
