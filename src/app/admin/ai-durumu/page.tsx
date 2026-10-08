import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { AiRecoveryButton } from "@/components/admin/AiRecoveryButton.tsx";

export const metadata = { title: "AI ve EVREN Sistem Durumu – DersBot Admin" };

export default async function AdminAiStatusPage() {
  await requireAdmin();

  const [
    successCount,
    failedCount,
    timeoutCount,
    runningCount,
    recentLogs,
  ] = await Promise.all([
    prisma.contentGenerationLog.count({ where: { status: "SUCCEEDED" } }),
    prisma.contentGenerationLog.count({ where: { status: "FAILED" } }),
    prisma.contentGenerationLog.count({ where: { status: "TIMEOUT" } }),
    prisma.contentGenerationLog.count({ where: { status: "RUNNING" } }),
    prisma.contentGenerationLog.findMany({
      take: 20,
      orderBy: { startedAt: "desc" },
      include: {
        assignment: { select: { id: true, topic: true, subject: true, grade: true } },
      },
    }),
  ]);

  const activeProvider = process.env.AI_PROVIDER || "evren (varsayılan)";
  const activeModel = process.env.EVREN_LLM_MODEL || "glm-5.3";

  // Calculate average duration of succeeded requests
  const completedLogs = recentLogs.filter((l) => l.finishedAt && l.status === "SUCCEEDED");
  const avgDurationMs =
    completedLogs.length > 0
      ? Math.round(
          completedLogs.reduce(
            (acc, l) => acc + (new Date(l.finishedAt!).getTime() - new Date(l.startedAt).getTime()),
            0
          ) / completedLogs.length
        )
      : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="editorial-kicker">YAPAY ZEKÂ MOTOR DENETİMİ · EVREN & LLM</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>AI ve EVREN Sistem Durumu</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
            Taslak oluşturma motorunun performansı, hata oranları ve işlem geçmişi.
          </p>
        </div>
        <AiRecoveryButton />
      </div>

      {/* Editorial Metrics Grid */}
      <div className="editorial-metrics" style={{ marginBottom: 28 }}>
        <div className="metric">
          <span className="metric-label">Aktif Sağlayıcı / Model</span>
          <div className="metric-value" style={{ fontSize: "1.25rem" }}>{activeModel}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Sağlayıcı: {activeProvider}</span>
        </div>

        <div className="metric">
          <span className="metric-label">Başarılı Üretim</span>
          <div className="metric-value" style={{ color: "var(--leaf)" }}>{successCount}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Doğrulanan ve kaydedilen</span>
        </div>

        <div className="metric">
          <span className="metric-label">Hata & Zaman Aşımı</span>
          <div className="metric-value" style={{ color: "var(--crimson)" }}>{failedCount + timeoutCount}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>{failedCount} Hata · {timeoutCount} Zaman Aşımı</span>
        </div>

        <div className="metric">
          <span className="metric-label">Ortalama Yanıt Süresi</span>
          <div className="metric-value" style={{ color: "var(--accent)" }}>
            {avgDurationMs ? `${(avgDurationMs / 1000).toFixed(1)} sn` : "—"}
          </div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>{runningCount > 0 ? `${runningCount} aktif işlem` : "Kuyruk boş"}</span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Yapay Zekâ İçerik Üretim Logları</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Son 20 üretim işlemi ve durum kodları</span>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Görev / Konu</th>
                <th>Ders & Sınıf</th>
                <th>Kapsam</th>
                <th>Durum</th>
                <th>Süre</th>
                <th>Hata Kodu / Detay</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Henüz AI generation log kaydı bulunmuyor.
                  </td>
                </tr>
              ) : (
                recentLogs.map((l) => {
                  const durationMs = l.finishedAt
                    ? new Date(l.finishedAt).getTime() - new Date(l.startedAt).getTime()
                    : null;
                  return (
                    <tr key={l.id}>
                      <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{formatDate(l.startedAt)}</td>
                      <td>
                        <strong>{l.assignment?.topic ?? l.assignmentId}</strong>
                      </td>
                      <td>
                        {l.assignment?.subject} <span className="muted">({l.assignment?.grade}. sınıf)</span>
                      </td>
                      <td>
                        <span className="badge">{l.scope}</span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              l.status === "SUCCEEDED"
                                ? "var(--ok-bg)"
                                : l.status === "RUNNING"
                                ? "var(--info-bg)"
                                : "var(--danger-bg)",
                            color:
                              l.status === "SUCCEEDED"
                                ? "var(--ok-text)"
                                : l.status === "RUNNING"
                                ? "var(--info-text)"
                                : "var(--danger-text)",
                            borderColor:
                              l.status === "SUCCEEDED"
                                ? "var(--ok-border)"
                                : l.status === "RUNNING"
                                ? "var(--info-border)"
                                : "var(--danger-border)",
                          }}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td>{durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"}</td>
                      <td style={{ fontSize: "0.82rem", color: "#dc2626" }}>
                        {l.errorMessage ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
