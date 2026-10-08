import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getClassroomRoster } from "@/lib/assessment/student-history-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ClassroomActions } from "@/components/teacher/ClassroomActions.tsx";
import { prisma } from "@/lib/db.ts";

export const metadata = { title: "Sınıf – Evde Etüt" };

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
      <p className="muted" style={{ marginBottom: 6 }}><Link href="/ogretmen/siniflar">← Sınıflarım</Link></p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: "4px 0 4px" }}>
            {r.classroom.name} <span className="muted" style={{ fontSize: "1rem" }}>({r.classroom.grade}. sınıf)</span>
            {r.classroom.archivedAt && (
              <span className="badge" style={{ marginLeft: 8, background: "var(--warn-bg)", color: "var(--warn-text)", borderColor: "var(--warn-border)" }}>
                Arşivlenmiş
              </span>
            )}
          </h1>
          {r.classroom.description && (
            <p className="muted" style={{ margin: "2px 0 6px", fontSize: "0.95rem" }}>{r.classroom.description}</p>
          )}
          <p className="muted" style={{ margin: "0 0 12px" }}>
            Katılma kodu: <span className="code" style={{ fontSize: "1rem", fontWeight: 700 }}>{r.classroom.joinCode}</span> · {r.roster.length} öğrenci · {assignmentCount} görev
          </p>
        </div>
      </div>

      <ClassroomActions
        classroom={r.classroom}
        studentCount={r.roster.length}
        assignmentCount={assignmentCount}
      />
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
