import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listAssignmentsForTeacher } from "@/lib/assignments/assignment-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { countPendingReviews } from "@/lib/assessment/review-service.ts";
import { DersBotTip } from "@/components/brand/DersBotTip.tsx";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ arsiv?: string; silindi?: string }>;
}) {
  const teacher = await requireTeacher();
  const { arsiv, silindi } = await searchParams;
  const archived = arsiv === "1";
  const [assignments, pending] = await Promise.all([
    listAssignmentsForTeacher(teacher.id, undefined, { archived }),
    countPendingReviews(teacher.id),
  ]);

  const publishedCount = assignments.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = assignments.filter((a) => a.status === "DRAFT").length;

  return (
    <>
      {/* Page Title & Kicker */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <span className="kicker">DERS ÖNCESİ HAZIRLIK YÖNETİMİ</span>
          <h1 style={{ margin: "2px 0 6px" }}>Görevler ve Çalışma Planı</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            Öğrencilerinizin dersten önce inceleyeceği MEB kazanım özetlerini ve mini testleri yönetin.
          </p>
        </div>
        <Link href="/ogretmen/gorevler/yeni" className="button primary">
          + Yeni Görev Oluştur
        </Link>
      </div>

      {silindi === "1" && <p className="notice-ok" role="status">Taslak görev başarıyla silindi.</p>}

      {/* Editorial Metrics Strip (No generic KPI cards!) */}
      <div className="editorial-metrics">
        <div className="metric-item">
          <div className="metric-value">%82</div>
          <div className="metric-label">Derse Hazır Öğrenciler</div>
          <div className="metric-desc">Yarınki derse ön hazırlığını tamamlayanlar</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">{assignments.length}</div>
          <div className="metric-label">Toplam Görev</div>
          <div className="metric-desc">{archived ? "Arşivlenmiş kayıtlar" : "Tüm aktif sınıflarınızda"}</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--ok)" }}>{publishedCount}</div>
          <div className="metric-label">Yayında</div>
          <div className="metric-desc">Öğrencilerin erişimine açık</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: pending > 0 ? "var(--secondary)" : "var(--muted)" }}>
            {pending}
          </div>
          <div className="metric-label">İnceleme Bekleyen</div>
          <div className="metric-desc">Puanlanacak açık uçlu cevap</div>
        </div>
      </div>

      {/* Pending Reviews Notice (Editorial Note) */}
      {pending > 0 && (
        <div
          style={{
            border: "1px solid var(--secondary-border)",
            backgroundColor: "var(--secondary-light)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <strong style={{ display: "block", color: "var(--secondary)", fontSize: "0.95rem" }}>
              {pending} açık uçlu cevap puanlanmayı bekliyor
            </strong>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Öğrencilerin derse hazır olma durumunun kesinleşmesi için değerlendirmeleri tamamlayın.
            </span>
          </div>
          <Link
            href="/ogretmen/degerlendirme"
            className="button secondary"
            style={{ minHeight: 32, fontSize: "0.85rem", padding: "4px 12px" }}
          >
            Değerlendirmeye Git →
          </Link>
        </div>
      )}

      {/* Assignments Workspace Panel */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{archived ? "Arşivlenen Görevler" : "Görev Listesi"}</h2>
            <span className="badge">{assignments.length} görev</span>
          </div>

          <div style={{ display: "flex", gap: 8, fontSize: "0.85rem" }}>
            <Link
              href="/ogretmen/gorevler"
              className={`button ghost ${!archived ? "primary" : ""}`}
              style={{ minHeight: 28, padding: "2px 10px", fontSize: "0.82rem" }}
            >
              Aktif Görevler
            </Link>
            <Link
              href="/ogretmen/gorevler?arsiv=1"
              className={`button ghost ${archived ? "primary" : ""}`}
              style={{ minHeight: 28, padding: "2px 10px", fontSize: "0.82rem" }}
            >
              Arşivlenmiş ({draftCount} taslak dahil)
            </Link>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 16px" }}>
            <div style={{ maxWidth: 460, margin: "0 auto 18px", textAlign: "left" }}>
              <DersBotTip title="DersBot Görev Rehberi">
                {archived
                  ? "Arşivlenmiş bir görev bulunmuyor. Aktif görevlerinizi listenizden inceleyebilirsiniz."
                  : "Henüz oluşturulmuş bir derse hazırlık görevi yok. MEB kazanımını seçerek yapay zekâ desteğiyle ilk görevinizi hazırlayabilirsiniz!"}
              </DersBotTip>
            </div>
            {!archived && (
              <Link href="/ogretmen/gorevler/yeni" className="button primary">
                + İlk Görevi Oluştur →
              </Link>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ders & Sınıf</th>
                  <th>Konu & Öğrenme Çıktısı</th>
                  <th>Durum</th>
                  <th>Soru Sayısı</th>
                  <th>Son Teslim Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div>
                        <strong>{a.subject}</strong>
                        <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                          {a.classroom.name} · {a.grade}. sınıf
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <Link href={`/ogretmen/gorevler/${a.id}`} style={{ fontWeight: 600 }}>
                          {a.topic}
                        </Link>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
                          {a.unitOrTheme}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${a.status}`}>
                        {a.status === "PUBLISHED" ? "Yayında" : a.status === "DRAFT" ? "Taslak" : a.status}
                      </span>
                    </td>
                    <td>
                      <span className="code">{a.questionCount} Soru</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem" }}>{formatDate(a.deadline)}</span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Link
                          href={`/ogretmen/gorevler/${a.id}`}
                          className="button"
                          style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.8rem" }}
                        >
                          Detay
                        </Link>
                        {a.status === "PUBLISHED" && (
                          <Link
                            href={`/ogretmen/gorevler/${a.id}/analiz`}
                            className="button"
                            style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.8rem" }}
                          >
                            Rapor
                          </Link>
                        )}
                        {a.status === "DRAFT" && (
                          <Link
                            href={`/ogretmen/gorevler/${a.id}/duzenle`}
                            className="button primary"
                            style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.8rem" }}
                          >
                            Düzenle
                          </Link>
                        )}
                      </div>
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
