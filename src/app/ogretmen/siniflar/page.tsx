import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listTeacherClassrooms } from "@/lib/accounts/account-service.ts";
import { CreateClassroomForm } from "@/components/teacher/CreateClassroomForm.tsx";

export default async function ClassroomsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const teacher = await requireTeacher();
  const { filtre } = await searchParams;
  const isArchiveView = filtre === "arsiv";

  const [activeClassrooms, archivedClassrooms] = await Promise.all([
    listTeacherClassrooms(teacher.id, { onlyArchived: false }),
    listTeacherClassrooms(teacher.id, { onlyArchived: true }),
  ]);

  const classrooms = isArchiveView ? archivedClassrooms : activeClassrooms;

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Sınıf Yönetimi</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Sınıflarınızı oluşturun, öğrenci katılım kodlarını paylaşın ve sınıf bazlı görevleri yönetin.
        </p>
      </div>

      {!isArchiveView && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: 12 }}>+ Yeni Sınıf Oluştur</h2>
          <CreateClassroomForm />
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 8 }}>
            <Link
              href="/ogretmen/siniflar"
              className={`button ${!isArchiveView ? "primary" : ""}`}
              style={{ minHeight: 32, fontSize: "0.85rem", padding: "4px 12px" }}
            >
              Aktif Sınıflar ({activeClassrooms.length})
            </Link>
            <Link
              href="/ogretmen/siniflar?filtre=arsiv"
              className={`button ${isArchiveView ? "primary" : ""}`}
              style={{ minHeight: 32, fontSize: "0.85rem", padding: "4px 12px" }}
            >
              Arşivlenmiş ({archivedClassrooms.length})
            </Link>
          </div>
          <span className="badge">
            {classrooms.length} {isArchiveView ? "arşivli sınıf" : "aktif sınıf"}
          </span>
        </div>

        {classrooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <p className="muted">{isArchiveView ? "Arşivlenmiş bir sınıfınız bulunmuyor." : "Henüz kayıtlı bir sınıfınız bulunmuyor."}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sınıf / Şube Adı</th>
                  <th>Kademesi</th>
                  <th>Katılma Kodu</th>
                  <th>Kayıtlı Öğrenci</th>
                  <th>Atanan Görev</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`} style={{ fontSize: "1rem", fontWeight: 700 }}>{c.name}</Link>
                    </td>
                    <td>
                      <span className="badge">{c.grade}. sınıf</span>
                    </td>
                    <td>
                      <span
                        className="code"
                        style={{
                          display: "inline-block",
                          letterSpacing: "0.12em",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          padding: "4px 8px",
                          color: "var(--accent)",
                        }}
                      >
                        {c.joinCode}
                      </span>
                    </td>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`}>{c._count.members} öğrenci →</Link>
                    </td>
                    <td>
                      <span className="muted">{c._count.assignments} görev</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info" style={{ marginTop: 16 }}>
          💡 <strong>Katılma Kodu Paylaşımı:</strong> Öğrencileriniz hesaplarını açtıktan sonra, bu kodu panolarındaki &ldquo;Sınıfa Katıl&rdquo; alanına girerek doğrudan ilgili sınıfa dahil olurlar.
        </div>
      </div>
    </>
  );
}
