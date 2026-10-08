import Link from "next/link";
import { prisma } from "@/lib/db.ts";
import { listAuditLogs } from "@/lib/admin/audit-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";

export const metadata = { title: "Admin Genel Bakış – Evde Etüt" };

const getSevenDaysAgo = () => new Date(Date.now() - 7 * 86_400_000);

export default async function AdminDashboardPage() {
  const sevenDaysAgo = getSevenDaysAgo();

  const [
    totalUsers,
    totalTeachers,
    totalStudents,
    newUsersLast7Days,
    activeClassrooms,
    archivedClassrooms,
    activeAssignments,
    archivedAssignments,
    newAssignmentsLast7Days,
    aiSuccessCount,
    aiFailedCount,
    aiTimeoutCount,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.classroom.count({ where: { archivedAt: null } }),
    prisma.classroom.count({ where: { archivedAt: { not: null } } }),
    prisma.assignment.count({ where: { archivedAt: null } }),
    prisma.assignment.count({ where: { archivedAt: { not: null } } }),
    prisma.assignment.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.contentGenerationLog.count({ where: { status: "SUCCEEDED" } }),
    prisma.contentGenerationLog.count({ where: { status: "FAILED" } }),
    prisma.contentGenerationLog.count({ where: { status: "TIMEOUT" } }),
    listAuditLogs(8),
  ]);

  const totalAi = aiSuccessCount + aiFailedCount + aiTimeoutCount;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div className="editorial-kicker">SİSTEM KONSOLU · MERKEZİ DENETİM</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>
          Yönetim & Operasyon Masası
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Platform genelindeki kullanıcı, sınıf, görev ve yapay zekâ altyapısının anlık durumu.
        </p>
      </div>

      {/* Editorial Metrics Grid */}
      <div className="editorial-metrics" style={{ marginBottom: 28 }}>
        <div className="metric">
          <span className="metric-label">Toplam Kullanıcı</span>
          <div className="metric-value">{totalUsers}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            <strong>{totalTeachers}</strong> öğretmen · <strong>{totalStudents}</strong> öğrenci
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--leaf)", marginTop: 4, fontWeight: 500 }}>
            +{newUsersLast7Days} son 7 günde yeni kayıt
          </div>
        </div>

        <div className="metric">
          <span className="metric-label">Aktif Sınıflar</span>
          <div className="metric-value">{activeClassrooms}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Eğitim verilen şube sayısı
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--amber)", marginTop: 4, fontWeight: 500 }}>
            {archivedClassrooms} arşivlenmiş şube
          </div>
        </div>

        <div className="metric">
          <span className="metric-label">Yayındaki Görevler</span>
          <div className="metric-value">{activeAssignments}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Öğrencilere açık hazırlık görevi
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: 4, fontWeight: 500 }}>
            {archivedAssignments} arşiv · +{newAssignmentsLast7Days} yeni (7 gün)
          </div>
        </div>

        <div className="metric">
          <span className="metric-label">AI Üretim Hacmi</span>
          <div className="metric-value">{totalAi}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            <span style={{ color: "var(--leaf)" }}>{aiSuccessCount} Başarılı</span> · <span style={{ color: "var(--crimson)" }}>{aiFailedCount} Hata</span>
          </span>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
            {aiTimeoutCount} zaman aşımı
          </div>
        </div>
      </div>

      {/* Quick Access Operational Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* Hızlı İşlemler */}
        <div className="editorial-panel">
          <div className="editorial-panel-header">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Hızlı Operasyonlar</h2>
              <span className="muted" style={{ fontSize: "0.82rem" }}>Sık kullanılan yönetim bağlantıları</span>
            </div>
          </div>
          <div style={{ padding: "16px 20px", display: "grid", gap: 8 }}>
            <Link
              href="/admin/davet-kodlari"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                backgroundColor: "var(--surface-subtle)",
                borderRadius: "var(--radius-xs)",
                textDecoration: "none",
                color: "var(--ink)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.92rem", display: "block" }}>Öğretmen Davet Kodları</strong>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Yeni okul / zümre kodları üretin</span>
              </div>
              <span style={{ color: "var(--accent)", fontSize: "0.88rem", fontWeight: 600 }}>Yönet →</span>
            </Link>

            <Link
              href="/admin/kullanicilar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                backgroundColor: "var(--surface-subtle)",
                borderRadius: "var(--radius-xs)",
                textDecoration: "none",
                color: "var(--ink)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.92rem", display: "block" }}>Kullanıcı Denetimi</strong>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Hesapları inceleyin ve askıya alın</span>
              </div>
              <span style={{ color: "var(--accent)", fontSize: "0.88rem", fontWeight: 600 }}>Görüntüle →</span>
            </Link>

            <Link
              href="/admin/ai-durumu"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                backgroundColor: "var(--surface-subtle)",
                borderRadius: "var(--radius-xs)",
                textDecoration: "none",
                color: "var(--ink)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.92rem", display: "block" }}>AI Motoru & Log Kurtarma</strong>
                <span className="muted" style={{ fontSize: "0.8rem" }}>EVREN durumunu ve takılı kalan istekleri çözün</span>
              </div>
              <span style={{ color: "var(--accent)", fontSize: "0.88rem", fontWeight: 600 }}>Kontrol Et →</span>
            </Link>

            <Link
              href="/admin/ayarlar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                backgroundColor: "var(--surface-subtle)",
                borderRadius: "var(--radius-xs)",
                textDecoration: "none",
                color: "var(--ink)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.92rem", display: "block" }}>Sistem & Posta Ayarları</strong>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Genel platform parametrelerini düzenleyin</span>
              </div>
              <span style={{ color: "var(--accent)", fontSize: "0.88rem", fontWeight: 600 }}>Yapılandır →</span>
            </Link>
          </div>
        </div>

        {/* Son Sistem Aktiviteleri */}
        <div className="editorial-panel">
          <div className="editorial-panel-header">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Son Güvenlik & Denetim Logları</h2>
              <span className="muted" style={{ fontSize: "0.82rem" }}>Yönetimsel işlem geçmişi</span>
            </div>
            <Link href="/admin/islem-gecmisi" style={{ fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none" }}>
              Tümünü Gör →
            </Link>
          </div>
          <div style={{ padding: "16px 20px" }}>
            {recentAuditLogs.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>Henüz kayıtlı bir denetim olayı bulunmuyor.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.86rem",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                    }}
                  >
                    <div>
                      <span className="code" style={{ marginRight: 6 }}>{log.action}</span>
                      <span className="muted">({log.entityType})</span>
                      {log.admin && <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>Yönetici: {log.admin.name}</span>}
                    </div>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>{formatDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
