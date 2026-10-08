import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getClassroomRoster } from "@/lib/assessment/student-history-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ClassroomActions } from "@/components/teacher/ClassroomActions.tsx";
import { prisma } from "@/lib/db.ts";

export const metadata = { title: "Sınıf Detayı – Evde Etüt" };

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const r = await getClassroomRoster(teacher.id, id);
  if (!r) notFound();

  const assignmentCount = await prisma.assignment.count({
    where: { classroomId: r.classroom.id },
  });

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link href="/ogretmen/siniflar" style={{ fontSize: "0.85rem", color: "var(--muted)", textDecoration: "none" }}>
          ← Sınıflarıma Dön
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <span className="kicker">ŞUBE ÇALIŞMA ALANI</span>
          <h1 style={{ margin: "2px 0 6px" }}>
            {r.classroom.name}
            <span style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
              ({r.classroom.grade}. sınıf)
            </span>
            {r.classroom.archivedAt && (
              <span className="badge" style={{ marginLeft: 8, backgroundColor: "var(--warn-bg)", color: "var(--warn-text)", borderColor: "var(--warn-border)" }}>
                Arşivlenmiş
              </span>
            )}
          </h1>
          {r.classroom.description && (
            <p style={{ margin: "2px 0 8px", fontSize: "0.92rem", color: "var(--text-secondary)" }}>
              {r.classroom.description}
            </p>
          )}
        </div>

        <ClassroomActions
          classroom={r.classroom}
          studentCount={r.roster.length}
          assignmentCount={assignmentCount}
        />
      </div>

      {/* Editorial Metric Strip for Classroom */}
      <div className="editorial-metrics" style={{ marginBottom: 24 }}>
        <div className="metric-item">
          <div className="metric-value">{r.roster.length}</div>
          <div className="metric-label">Kayıtlı Öğrenci</div>
          <div className="metric-desc">Sınıfta aktif olarak yer alan</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">{assignmentCount}</div>
          <div className="metric-label">Atanan Görev</div>
          <div className="metric-desc">Bu şubeye özel hazırlanan</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ fontFamily: "var(--font-mono)", fontSize: "1.7rem", color: "var(--accent)" }}>
            {r.classroom.joinCode}
          </div>
          <div className="metric-label">Katılım Kodu</div>
          <div className="metric-desc">Öğrencilerle paylaşılacak kod</div>
        </div>
      </div>

      {/* Student Roster Table Panel */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Öğrenci Listesi ve Durumları</h2>
          <span className="badge">{r.roster.length} öğrenci</span>
        </div>

        {r.roster.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 16px" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
              Bu sınıfa henüz öğrenci katılmadı. Öğrencilerinize <span className="code">{r.classroom.joinCode}</span> katılım kodunu vererek dahil olmalarını sağlayın.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Katılma Tarihi</th>
                  <th>Derse Hazır</th>
                  <th>Tekrar Gerekli</th>
                  <th>Hazırlık Ortalaması</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {r.roster.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/ogretmen/ogrenciler/${s.id}`} style={{ fontWeight: 600 }}>
                        {s.name}
                      </Link>
                    </td>
                    <td>{formatDate(s.joinedAt)}</td>
                    <td>
                      <span className="badge READY">{s.ready} görev</span>
                    </td>
                    <td>
                      <span className="badge NEEDS_REVIEW">{s.needsReview} görev</span>
                    </td>
                    <td>
                      <strong>{s.average === null ? "—" : `%${s.average}`}</strong>
                    </td>
                    <td>
                      <Link
                        href={`/ogretmen/ogrenciler/${s.id}`}
                        className="button"
                        style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.8rem" }}
                      >
                        Geçmişi Gör →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
