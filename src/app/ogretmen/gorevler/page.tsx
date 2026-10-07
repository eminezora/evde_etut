import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listAssignmentsForTeacher } from "@/lib/assignments/assignment-service.ts";
import { formatDate, statusLabel } from "@/lib/assignments/format.ts";
import { countPendingReviews } from "@/lib/assessment/review-service.ts";

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ arsiv?: string; silindi?: string }> }) {
  const teacher = await requireTeacher();
  const { arsiv, silindi } = await searchParams;
  const archived = arsiv === "1";
  const [assignments, pending] = await Promise.all([listAssignmentsForTeacher(teacher.id, undefined, { archived }), countPendingReviews(teacher.id)]);

  const publishedCount = assignments.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = assignments.filter((a) => a.status === "DRAFT").length;

  return (
    <>
      {/* Page Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Görevler ve Ön Hazırlık</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
            Öğrencileriniz için MEB kazanımlarına bağlı derse hazırlık ödevlerini yönetin ve takip edin.
          </p>
        </div>
        <Link href="/ogretmen/gorevler/yeni" className="button primary">
          + Yeni Görev Oluştur
        </Link>
      </div>

      {/* KPI Stats Strip */}
      <div className="kpi-row">
        <div className="kpi">
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>TOPLAM GÖREV</span>
          <span className="kpi-value">{assignments.length}</span>
          <span className="muted" style={{ fontSize: "0.82rem" }}>Tüm sınıflarınızda</span>
        </div>
        <div className="kpi">
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>YAYINDA</span>
          <span className="kpi-value" style={{ color: "var(--ok)" }}>{publishedCount}</span>
          <span className="muted" style={{ fontSize: "0.82rem" }}>Öğrenciler erişebiliyor</span>
        </div>
        <div className="kpi">
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>TASLAK</span>
          <span className="kpi-value" style={{ color: "var(--warn)" }}>{draftCount}</span>
          <span className="muted" style={{ fontSize: "0.82rem" }}>Düzenleme bekleyen</span>
        </div>
        <div className="kpi">
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>DEĞERLENDİRME</span>
          <span className="kpi-value" style={{ color: pending > 0 ? "var(--accent)" : "var(--muted)" }}>{pending}</span>
          <span className="muted" style={{ fontSize: "0.82rem" }}>Açık uçlu cevap</span>
        </div>
      </div>

      {/* Pending Reviews Notice Card */}
      {pending > 0 && (
        <div className="card" style={{ background: "var(--info-bg)", border: "1px solid var(--info-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>✍️</span>
            <div>
              <strong style={{ display: "block", color: "var(--info-text)" }}>
                {pending} açık uçlu cevap puanlanmayı bekliyor
              </strong>
              <span className="muted" style={{ fontSize: "0.88rem" }}>
                Öğrencilerin derse hazır olma durumunun kesinleşmesi için değerlendirmeyi tamamlayın.
              </span>
            </div>
          </div>
          <Link href="/ogretmen/degerlendirme" className="button primary" style={{ minHeight: 36, padding: "6px 14px" }}>
            Şimdi Değerlendir →
          </Link>
        </div>
      )}

      {silindi === "1" && <p className="notice-inline ok" role="status">Taslak görev silindi.</p>}

      {/* Assignments Table Card */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2>{archived ? "Arşivlenen Görevler" : "Tüm Görevler"}</h2>
          <div className="row">
            <span className="badge">{assignments.length} görev listelendi</span>
            <Link href={archived ? "/ogretmen/gorevler" : "/ogretmen/gorevler?arsiv=1"} style={{ fontSize: "0.88rem" }}>
              {archived ? "← Aktif görevlere dön" : "📦 Arşivlenenler"}
            </Link>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>📋</span>
            <p className="muted" style={{ fontSize: "1.05rem" }}>{archived ? "Arşivlenmiş görev yok." : "Henüz oluşturulmuş bir görev bulunmuyor."}</p>
            <Link href="/ogretmen/gorevler/yeni" className="button primary" style={{ marginTop: 8 }}>
              İlk Görevi Oluştur →
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Konu / Başlık</th>
                  <th>Sınıf</th>
                  <th>Ders</th>
                  <th>Kazanım</th>
                  <th>Son Tarih</th>
                  <th>Durum</th>
                  <th style={{ textAlign: "right" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/ogretmen/gorevler/${a.id}`} style={{ fontWeight: 600 }}>
                        {a.topic}
                      </Link>
                    </td>
                    <td>
                      <span className="badge" style={{ background: "var(--surface-subtle)" }}>
                        {a.classroom.name}
                      </span>
                    </td>
                    <td>{a.subject}</td>
                    <td>
                      <span className="code" style={{ display: "inline" }}>
                        {a._count.assignmentOutcomes} çıktı
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: "0.88rem" }}>{formatDate(a.deadline)}</td>
                    <td>
                      <span className={`badge ${a.status}`}>
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <Link href={`/ogretmen/gorevler/${a.id}`} className="button ghost" style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.82rem" }}>
                          İncele
                        </Link>
                        {a.status === "PUBLISHED" && (
                          <Link href={`/ogretmen/gorevler/${a.id}/analiz`} className="button" style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.82rem", borderColor: "var(--accent-border)", color: "var(--accent)" }}>
                            📊 Rapor
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
