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
      <div style={{ marginBottom: 28, borderBottom: "1px solid #e2e8f0", paddingBottom: 16 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Sistem Genel Bakış
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Platform genelindeki kullanıcı, sınıf, görev ve yapay zekâ metriklerinin anlık durumu.
        </p>
      </div>

      {/* Editorial Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Kullanıcılar */}
        <div style={{ padding: "18px 20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Toplam Kullanıcı
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "4px 0" }}>
            {totalUsers}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            <strong>{totalTeachers}</strong> öğretmen · <strong>{totalStudents}</strong> öğrenci
          </div>
          <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: 6, fontWeight: 500 }}>
            +{newUsersLast7Days} son 7 günde kayıt
          </div>
        </div>

        {/* Sınıflar */}
        <div style={{ padding: "18px 20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sınıflar
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "4px 0" }}>
            {activeClassrooms}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            Aktif eğitim verilen sınıf
          </div>
          <div style={{ fontSize: "0.75rem", color: "#d97706", marginTop: 6, fontWeight: 500 }}>
            {archivedClassrooms} arşivlenmiş sınıf
          </div>
        </div>

        {/* Görevler */}
        <div style={{ padding: "18px 20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Görevler
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "4px 0" }}>
            {activeAssignments}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            Yayında olan hazırlık görevi
          </div>
          <div style={{ fontSize: "0.75rem", color: "#2563eb", marginTop: 6, fontWeight: 500 }}>
            {archivedAssignments} arşivlenmiş · +{newAssignmentsLast7Days} yeni (7 gün)
          </div>
        </div>

        {/* AI Durumu */}
        <div style={{ padding: "18px 20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            AI Üretim Durumu
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "4px 0" }}>
            {totalAi}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
            <span style={{ color: "#059669" }}>{aiSuccessCount} Başarılı</span> · <span style={{ color: "#dc2626" }}>{aiFailedCount} Hata</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 6 }}>
            {aiTimeoutCount} zaman aşımı
          </div>
        </div>
      </div>

      {/* Quick Access Operational Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* Hızlı İşlemler */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 16px" }}>Hızlı Operasyonlar</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href="/admin/davet-kodlari"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", textDecoration: "none", color: "#1e293b", border: "1px solid #e2e8f0" }}
            >
              <span>🎟️ Yeni Öğretmen Davet Kodu Oluştur</span>
              <span style={{ color: "#2563eb" }}>Yönet →</span>
            </Link>
            <Link
              href="/admin/kullanicilar"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", textDecoration: "none", color: "#1e293b", border: "1px solid #e2e8f0" }}
            >
              <span>👥 Kullanıcı Durumlarını İncele</span>
              <span style={{ color: "#2563eb" }}>Görüntüle →</span>
            </Link>
            <Link
              href="/admin/ai-durumu"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", textDecoration: "none", color: "#1e293b", border: "1px solid #e2e8f0" }}
            >
              <span>🤖 AI Üretim Logları ve Kurtarma</span>
              <span style={{ color: "#2563eb" }}>Kontrol Et →</span>
            </Link>
            <Link
              href="/admin/ayarlar"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", textDecoration: "none", color: "#1e293b", border: "1px solid #e2e8f0" }}
            >
              <span>⚙️ Sistem Ayarlarını Yapılandır</span>
              <span style={{ color: "#2563eb" }}>Düzenle →</span>
            </Link>
          </div>
        </div>

        {/* Son Sistem Aktiviteleri */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Son Sistem Aktiviteleri</h2>
            <Link href="/admin/islem-gecmisi" style={{ fontSize: "0.85rem", color: "#2563eb" }}>Tümünü Gör →</Link>
          </div>
          {recentAuditLogs.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>Henüz kayıtlı bir audit olayı bulunmuyor.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentAuditLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.84rem", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: "#0f172a" }}>{log.action}</span>
                    <span style={{ color: "#64748b", marginLeft: 6 }}>({log.entityType})</span>
                    {log.admin && <span style={{ color: "#94a3b8", display: "block", fontSize: "0.78rem" }}>Admin: {log.admin.name}</span>}
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>{formatDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
