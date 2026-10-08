import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listTeacherClassrooms } from "@/lib/accounts/account-service.ts";
import { CreateClassroomForm } from "@/components/teacher/CreateClassroomForm.tsx";
import { DersBotTip } from "@/components/brand/DersBotTip.tsx";

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
      <div style={{ marginBottom: 20 }}>
        <span className="kicker">ÖĞRETİM KADEMELERİ VE ŞUBELER</span>
        <h1 style={{ margin: "2px 0 6px" }}>Sınıf Yönetimi</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          Sınıflarınızı oluşturun, öğrenci katılım kodlarını paylaşın ve sınıf bazlı görevleri yönetin.
        </p>
      </div>

      {!isArchiveView && (
        <div className="editorial-panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: 12 }}>+ Yeni Sınıf Tanımla</h2>
          <CreateClassroomForm />
        </div>
      )}

      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/ogretmen/siniflar"
              className={`button ${!isArchiveView ? "primary" : "ghost"}`}
              style={{ minHeight: 30, fontSize: "0.82rem", padding: "2px 12px" }}
            >
              Aktif Sınıflar ({activeClassrooms.length})
            </Link>
            <Link
              href="/ogretmen/siniflar?filtre=arsiv"
              className={`button ${isArchiveView ? "primary" : "ghost"}`}
              style={{ minHeight: 30, fontSize: "0.82rem", padding: "2px 12px" }}
            >
              Arşivlenmiş ({archivedClassrooms.length})
            </Link>
          </div>

          <span className="badge">
            {classrooms.length} {isArchiveView ? "arşivli şube" : "aktif şube"}
          </span>
        </div>

        {classrooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "left" }}>
              <DersBotTip title="DersBot Sınıf Rehberi">
                {isArchiveView
                  ? "Arşivlenmiş bir sınıfınız bulunmuyor. Aktif sınıflarınızı yukarıdaki menüden inceleyebilirsiniz."
                  : "Henüz oluşturulmuş bir sınıfınız yok. Yukarıdaki formdan şube adını ve kademesini seçerek hemen ilk sınıfınızı oluşturun!"}
              </DersBotTip>
            </div>
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
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`} style={{ fontWeight: 700, fontSize: "0.98rem" }}>
                        {c.name}
                      </Link>
                      {c.description && (
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge">{c.grade}. sınıf</span>
                    </td>
                    <td>
                      <span
                        className="code"
                        style={{
                          letterSpacing: "0.08em",
                          fontSize: "0.92rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          color: "var(--accent)",
                        }}
                      >
                        {c.joinCode}
                      </span>
                    </td>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`} style={{ fontSize: "0.88rem" }}>
                        {c._count.members} öğrenci
                      </Link>
                    </td>
                    <td>
                      <span className="muted" style={{ fontSize: "0.88rem" }}>{c._count.assignments} görev</span>
                    </td>
                    <td>
                      <Link
                        href={`/ogretmen/siniflar/${c.id}`}
                        className="button"
                        style={{ minHeight: 28, padding: "2px 10px", fontSize: "0.8rem" }}
                      >
                        Yönet →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <DersBotTip title="DersBot Sınıf Katılım Kodu Rehberi">
            Öğrencileriniz hesaplarını açtıktan sonra panolarındaki <strong>&ldquo;Sınıfa Katıl&rdquo;</strong> alanına bu 8 haneli kodu girerek doğrudan şubenize kaydolurlar. Dilediğiniz an sınıf detayından kodu yenileyebilirsiniz.
          </DersBotTip>
        </div>
      </div>
    </>
  );
}
