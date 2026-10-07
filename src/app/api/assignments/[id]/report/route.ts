// GET /api/assignments/:id/report – CSV export of the class readiness report (owner teacher only).
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { getAssignmentReport, reportToCsv } from "@/lib/analytics/assignment-report.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return jsonError(401, "Oturum açmanız gerekiyor.");
  const report = await getAssignmentReport(teacher.id, (await params).id);
  if (!report) return jsonError(404, "Görev bulunamadı.");
  const safe = (x: string) => x.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60);
  const fileName = `${safe(report.assignment.classroom)}-${safe(report.assignment.topic)}-hazirlik-raporu.csv`;
  return new Response(reportToCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hazirlik-raporu.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
