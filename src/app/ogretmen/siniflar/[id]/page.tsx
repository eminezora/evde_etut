// Classroom roster: students of one of the teacher's classrooms, with links to their history.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getClassroomRoster } from "@/lib/assessment/student-history-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";

export const metadata = { title: "Sınıf – Evde Etüt" };

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const r = await getClassroomRoster(teacher.id, (await params).id);
  if (!r) notFound();
  return (
    <>
      <p className="muted" style={{ marginBottom: 6 }}><Link href="/ogretmen/siniflar">← Sınıflarım</Link></p>
      <h1 style={{ margin: "4px 0 4px" }}>{r.classroom.name} <span className="muted" style={{ fontSize: "1rem" }}>({r.classroom.grade}. sınıf)</span></h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>Katılma kodu: <span className="code">{r.classroom.joinCode}</span> · {r.roster.length} öğrenci</p>
      <div className="card">
        <h2>Öğrenciler</h2>
        {r.roster.length === 0 ? (
          <p className="muted">Bu sınıfa henüz öğrenci katılmadı. Öğrencilerinize <span className="code">{r.classroom.joinCode}</span> kodunu verin.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Öğrenci</th><th>Katılma</th><th>Derse hazır</th><th>Tekrar gerekli</th><th>Ortalama</th><th></th></tr></thead>
              <tbody>
                {r.roster.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/ogretmen/ogrenciler/${s.id}`}>{s.name}</Link></td>
                    <td>{formatDate(s.joinedAt)}</td>
                    <td>{s.ready}</td>
                    <td>{s.needsReview}</td>
                    <td>{s.average === null ? "—" : `%${s.average}`}</td>
                    <td><Link href={`/ogretmen/ogrenciler/${s.id}`} className="button" style={{ minHeight: 30, padding: "3px 10px", fontSize: "0.82rem" }}>Geçmişi Gör</Link></td>
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
