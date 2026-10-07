// Öğrenci performans geçmişi (only for students in one of the teacher's classrooms).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getStudentHistory } from "@/lib/assessment/student-history-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";

export const metadata = { title: "Öğrenci Geçmişi – Evde Etüt" };
const label = (s: string | undefined) => (s ? STATUS_LABELS[s as StudentStatus] ?? s : "Başlamadı");

export default async function StudentHistoryPage({ params }: { params: Promise<{ studentId: string }> }) {
  const teacher = await requireTeacher();
  const { studentId } = await params;
  const h = await getStudentHistory(teacher.id, studentId);
  if (!h) notFound();
  return (
    <>
      <p className="muted" style={{ marginBottom: 6 }}>
        {h.classrooms.map((c, i) => (
          <span key={c.id}>{i > 0 && " · "}<Link href={`/ogretmen/siniflar/${c.id}`}>← {c.name} sınıfı</Link></span>
        ))}
      </p>
      <h1 style={{ margin: "4px 0 4px" }}>{h.student.name}</h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>Öğrenci performans geçmişi · {h.classrooms.map((c) => c.name).join(", ")}</p>

      <div className="card">
        <div className="stat-grid">
          <div className="stat"><span className="muted">Toplam görev</span><strong>{h.stats.total}</strong></div>
          <div className="stat"><span className="muted">Tamamlanan</span><strong>{h.stats.completed}</strong></div>
          <div className="stat"><span className="muted">Derse hazır</span><strong style={{ color: "var(--ok)" }}>{h.stats.ready}</strong></div>
          <div className="stat"><span className="muted">Tekrar gerekli</span><strong style={{ color: "var(--warn)" }}>{h.stats.needsReview}</strong></div>
          <div className="stat"><span className="muted">Ortalama puan</span><strong>{h.stats.averageScore === null ? "—" : `%${h.stats.averageScore}`}</strong></div>
        </div>
        {h.stats.pendingReview > 0 && <p className="notice-inline" style={{ margin: "12px 0 0" }}>{h.stats.pendingReview} görevde açık uçlu cevaplar puanlanmayı bekliyor.</p>}
      </div>

      {h.recent.length > 0 && (
        <div className="card">
          <h2>Son Aktiviteler</h2>
          <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
            {h.recent.map((r) => (
              <li key={r.id}>{formatDate(r.sa!.updatedAt)} · <strong>{r.topic}</strong> — {label(r.sa!.status)}{r.sa!.latestScore !== null ? ` (%${r.sa!.latestScore})` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Görevler</h2>
        {h.rows.length === 0 ? (
          <p className="muted">Bu öğrencinin sınıfına henüz yayınlanmış görev yok.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Görev</th><th>Ders</th><th>Son tarih</th><th>Puan</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {h.rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/ogretmen/gorevler/${r.id}/analiz`}>{r.topic}</Link><div className="muted" style={{ fontSize: "0.78rem" }}>{r.classroom.name}</div></td>
                    <td>{r.subject}</td>
                    <td>{formatDate(r.deadline)}</td>
                    <td>{r.sa?.latestScore === null || r.sa?.latestScore === undefined ? "—" : `%${r.sa.latestScore}`}</td>
                    <td>{label(r.sa?.status)}</td>
                    <td>
                      {r.sa && r.sa.attemptCount > 0 ? (
                        <Link href={`/ogretmen/gorevler/${r.id}/ogrenci/${h.student.id}`} className="button" style={{ minHeight: 30, padding: "3px 10px", fontSize: "0.82rem", whiteSpace: "nowrap" }}>Cevap Kağıdı</Link>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.82rem" }}>—</span>
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
