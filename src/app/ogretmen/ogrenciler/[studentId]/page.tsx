import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getStudentHistory } from "@/lib/assessment/student-history-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";

export const metadata = { title: "Öğrenci Gelişim Geçmişi – DersBot" };
const label = (s: string | undefined) => (s ? STATUS_LABELS[s as StudentStatus] ?? s : "Başlamadı");

export default async function StudentHistoryPage({ params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await requireTeacher();
  const { studentId } = await params;
  const h = await getStudentHistory(teacher.id, studentId);
  if (!h) notFound();

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {h.classrooms.map((c, i) => (
            <span key={c.id}>
              {i > 0 && " · "}
              <Link href={`/ogretmen/siniflar/${c.id}`} style={{ textDecoration: "none" }}>
                ← {c.name} Şubesine Dön
              </Link>
            </span>
          ))}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span className="kicker">ÖĞRENCİ GELİŞİM DOSYASI</span>
        <h1 style={{ margin: "2px 0 4px" }}>{h.student.name}</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          Kayıtlı Şubeler: {h.classrooms.map((c) => `${c.name} (${c.grade}. sınıf)`).join(", ")}
        </p>
      </div>

      {/* Editorial Metrics Strip */}
      <div className="editorial-metrics" style={{ marginBottom: 24 }}>
        <div className="metric-item">
          <div className="metric-value">{h.stats.total}</div>
          <div className="metric-label">Toplam Görev</div>
          <div className="metric-desc">Öğrenciye atanan tüm ödevler</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">{h.stats.completed}</div>
          <div className="metric-label">Tamamlanan</div>
          <div className="metric-desc">Ön kontrolü bitirilen</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--ok)" }}>{h.stats.ready}</div>
          <div className="metric-label">Derse Hazır</div>
          <div className="metric-desc">Başarı eşiğini geçenler</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--warn)" }}>{h.stats.needsReview}</div>
          <div className="metric-label">Tekrar Gerekli</div>
          <div className="metric-desc">Eşiğin altında kalanlar</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--accent)" }}>
            {h.stats.averageScore === null ? "—" : `%${h.stats.averageScore}`}
          </div>
          <div className="metric-label">Ortalama Puan</div>
          <div className="metric-desc">Genel ön bilgi ortalaması</div>
        </div>
      </div>

      {h.stats.pendingReview > 0 && (
        <div className="editorial-panel" style={{ borderLeft: "3px solid var(--secondary)", backgroundColor: "var(--secondary-light)", padding: "14px 18px", marginBottom: 20 }}>
          <strong style={{ color: "var(--secondary)", fontSize: "0.92rem" }}>
            {h.stats.pendingReview} görevde açık uçlu yanıtlar değerlendirme bekliyor.
          </strong>
        </div>
      )}

      {/* Tasks History Table Panel */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Görev Geçmişi ve Sonuçları</h2>
          <span className="badge">{h.rows.length} kayıt</span>
        </div>

        {h.rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Bu öğrencinin sınıfına henüz görev atanmadı.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Görev / Konu</th>
                  <th>Ders & Şube</th>
                  <th>Son Teslim</th>
                  <th>Puan</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {h.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/ogretmen/gorevler/${r.id}/analiz`} style={{ fontWeight: 600 }}>
                        {r.topic}
                      </Link>
                    </td>
                    <td>
                      <div>
                        {r.subject}
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{r.classroom.name}</div>
                      </div>
                    </td>
                    <td>{formatDate(r.deadline)}</td>
                    <td>
                      <strong>{r.sa?.latestScore === null || r.sa?.latestScore === undefined ? "—" : `%${r.sa.latestScore}`}</strong>
                    </td>
                    <td>
                      <span className={`badge ${r.sa?.status === "READY_FOR_CLASS" ? "READY" : r.sa?.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : ""}`}>
                        {label(r.sa?.status)}
                      </span>
                    </td>
                    <td>
                      {r.sa && r.sa.attemptCount > 0 ? (
                        <Link
                          href={`/ogretmen/gorevler/${r.id}/ogrenci/${h.student.id}`}
                          className="button"
                          style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                        >
                          Cevap Kağıdı →
                        </Link>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.82rem" }}>Başlamadı</span>
                      )}
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
