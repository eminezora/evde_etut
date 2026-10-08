// POST /api/assignments/:id/content/generate – start an AI draft for { scope: ALL | SUMMARY | QUESTIONS }.
// GET  /api/assignments/:id/content/generate – state of the latest generation job (polled by the editor).
//
// The AI call takes ~1 minute, which is too long to hold one browser request open reliably (school
// proxies, sleeping laptops and mobile networks drop it, leaving the editor waiting forever). So POST
// only validates and takes the lock, answers 202 at once, and the provider call + save run after the
// response via `after()` – still inside this function's maxDuration. The result is always saved as
// AI_GENERATED_DRAFT; it is never published automatically.
import { after, NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { getGenerationStatus, startStudyContentGeneration } from "@/lib/content/content-service.ts";
import { readBody, withTeacher } from "@/lib/http/content-route.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

// Must exceed AI_TIMEOUT_MS (default 90 s) so a timed-out call can still be recorded as failed.
// The editor polls the job status, so nobody waits on this request.
export const maxDuration = 180;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const started = await startStudyContentGeneration(teacher.id, id, body);
  if (!started.ok) {
    const first = Object.values(started.errors).flat()[0] ?? "İşlem yapılamadı.";
    return NextResponse.json({ error: first, code: started.code, errors: started.errors }, { status: started.status });
  }
  const { jobId, scope, run } = started.data;
  after(async () => {
    try {
      await run();
    } catch (err) {
      console.error(`[ai:lifecycle] after_execution_failed: assignment=${id} jobId=${jobId} error=${err instanceof Error ? err.message : String(err)}`);
    }
  });
  return NextResponse.json({
    ok: true,
    data: {
      jobId,
      scope,
      state: "GENERATING",
      status: "RUNNING",
      generationStartedAt: new Date().toISOString(),
    },
  }, { status: 202 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withTeacher((teacherId) => getGenerationStatus(teacherId, id));
}
