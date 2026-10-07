import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listAssignmentsForTeacher } from "@/lib/assignments/assignment-service.ts";
import { formatDate, statusLabel } from "@/lib/assignments/format.ts";
import { countPendingReviews } from "@/lib/assessment/review-service.ts";

export default async function AssignmentsPage() {
  const teacher = await requireTeacher();
  const [assignments, pending] = await Promise.all([listAssignmentsForTeacher(teacher.id), countPendingReviews(teacher.id)]);
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Görevler</h1>
        <Link href="/ogretmen/gorevler/yeni">+ Yeni görev</Link>
      </div>
      <div className="card">
        <h2>Değerlendirme Bekleyenler</h2>
        {pending === 0 ? (
          <p className="muted">Puanlanmayı bekleyen açık uçlu cevap yok.</p>
        ) : (
          <p><strong>{pending}</strong> açık uçlu cevap puanlanmayı bekliyor. <Link href="/ogretmen/degerlendirme">Değerlendir →</Link></p>
        )}
      </div>
      <div className="card">
        {assignments.length === 0 ? (
          <p className="muted">Henüz görev yok.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Konu</th><th>Sınıf</th><th>Ders</th><th>Çıktı</th><th>Son tarih</th><th>Durum</th></tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/ogretmen/gorevler/${a.id}`}>{a.topic}</Link></td>
                  <td>{a.classroom.name}</td>
                  <td>{a.subject}</td>
                  <td>{a._count.assignmentOutcomes}</td>
                  <td>{formatDate(a.deadline)}</td>
                  <td><span className={`badge ${a.status}`}>{statusLabel(a.status)}</span></td>
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
