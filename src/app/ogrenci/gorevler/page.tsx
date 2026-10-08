import Link from "next/link";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentDashboard, type DashboardCategory } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, stepIndex, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { listStudentClassrooms } from "@/lib/accounts/account-service.ts";
import { JoinClassroomForm } from "@/components/student/JoinClassroomForm.tsx";

const TIMELINE_SECTIONS: { key: DashboardCategory; title: string; subtitle: string; empty: string }[] = [
  { key: "UPCOMING", title: "Öncelikli Çalışma Planı", subtitle: "Yarınki dersler için hazırlanacak yeni ödevler", empty: "Şu an sırada bekleyen yeni görev bulunmuyor. Harika bir durumdasın!" },
  { key: "IN_PROGRESS", title: "Devam Eden Çalışmalar", subtitle: "Özeti okunmuş veya yarıda kalmış hazırlıklar", empty: "Yarım kalmış bir çalışma bulunmuyor." },
  { key: "NEEDS_REVIEW", title: "Tekrar ve Pekiştirme", subtitle: "Eksik kalan kavramları gözden geçirebileceğin görevler", empty: "Tekrar etmen gereken bir konu bulunmuyor." },
  { key: "READY", title: "Tamamlanan ve Derse Hazır Görevler", subtitle: "Başarıyla bitirilen derse hazırlık föyleri", empty: "Henüz tamamlanan bir çalışma yok." },
  { key: "EXPIRED", title: "Süresi Geçen Görevler", subtitle: "Son teslim tarihi geçmiş çalışmalar", empty: "Süresi geçmiş bir görev bulunmuyor." },
];

export default async function StudentDashboardPage() {
  const student = await requireStudent();
  const [cards, classrooms] = await Promise.all([getStudentDashboard(student.id), listStudentClassrooms(student.id)]);

  const readyCount = cards.filter((c) => c.category === "READY").length;
  const inProgressCount = cards.filter((c) => c.category === "IN_PROGRESS" || c.category === "UPCOMING").length;
  const reviewCount = cards.filter((c) => c.category === "NEEDS_REVIEW").length;

  return (
    <>
      {/* Editorial Dashboard Hero Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="kicker">ÖĞRENCİ ÇALIŞMA PLANI</span>
        <h1 style={{ fontSize: "2.3rem", margin: "2px 0 8px" }}>Bugün neye hazırlanıyoruz?</h1>
        <p className="muted" style={{ margin: 0, fontSize: "1rem", maxWidth: 680 }}>
          Yarınki derslerin için öğretmenlerinin hazırladığı 5 dakikalık MEB konu özetlerini oku, mini testini çöz ve sınıfa tam hazır katıl.
        </p>
      </div>

      {/* Editorial Metrics Strip */}
      <div className="editorial-metrics" style={{ marginBottom: 28 }}>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--accent)" }}>{inProgressCount}</div>
          <div className="metric-label">Hazırlık Bekleyen</div>
          <div className="metric-desc">Bugün çalışılması gereken görev</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--ok)" }}>{readyCount}</div>
          <div className="metric-label">Derse Hazır</div>
          <div className="metric-desc">Başarıyla tamamladığın föyler</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: reviewCount > 0 ? "var(--warn)" : "var(--muted)" }}>{reviewCount}</div>
          <div className="metric-label">Tekrar Gerekli</div>
          <div className="metric-desc">Pekiştirilmesi önerilen konular</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">{classrooms.length}</div>
          <div className="metric-label">Kayıtlı Sınıf</div>
          <div className="metric-desc">Dahil olduğun okul şubeleri</div>
        </div>
      </div>

      {/* Sınıfa Katıl ve Sınıflarım Bölümü */}
      <section id="siniflarim" className="editorial-panel" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 14 }}>
          <h2 style={{ fontSize: "1.15rem", margin: 0 }}>Kayıtlı Olduğum Sınıflar</h2>
          <span className="badge">{classrooms.length} Sınıf</span>
        </div>

        {classrooms.length === 0 ? (
          <div style={{ padding: "16px 0" }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              Henüz bir sınıfa katılmadın. Öğretmeninin paylaştığı 8 haneli katılım kodunu girerek sınıfına dahil olabilirsin:
            </p>
            <JoinClassroomForm />
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              {classrooms.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "1rem" }}>🏫</span>
                  <div>
                    <strong style={{ fontSize: "0.92rem", display: "block" }}>{c.name} ({c.grade}. sınıf)</strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Öğretmen: {c.teacher.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BAŞKA BİR SINIF KODU İLE KATIL</span>
              <div style={{ marginTop: 6 }}>
                <JoinClassroomForm />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Görevler: Timeline / Çalışma Planı Düzeni */}
      <section id="gorevler">
        {TIMELINE_SECTIONS.map((sec) => {
          const list = cards.filter((c) => c.category === sec.key);
          if (list.length === 0 && (sec.key === "EXPIRED" || sec.key === "NEEDS_REVIEW")) return null;

          return (
            <div key={sec.key} className="editorial-panel" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", margin: "0 0 2px" }}>{sec.title}</h2>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>{sec.subtitle}</span>
                </div>
                <span className="badge">{list.length} Görev</span>
              </div>

              {list.length === 0 ? (
                <p className="muted" style={{ margin: "10px 0", fontSize: "0.9rem" }}>{sec.empty}</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {list.map((c) => {
                    const progress = Math.round((stepIndex(c.status) / 4) * 100);
                    const isDone = c.status === "READY_FOR_CLASS";

                    return (
                      <div
                        key={c.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-xs)",
                          padding: "16px 18px",
                          backgroundColor: "var(--surface)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          transition: "border-color 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>
                              {c.subject}
                            </span>
                            <span className="muted" style={{ fontSize: "0.82rem" }}>
                              {c.classroom} · {c.teacher}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                            📅 Son teslim: {formatDate(c.deadline)}
                          </span>
                        </div>

                        <div>
                          <Link href={`/ogrenci/gorevler/${c.id}`} style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                            {c.topic}
                          </Link>
                        </div>

                        {/* Progress Bar & Status */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                            <span className="muted">Hazırlık Aşaması</span>
                            <span style={{ fontWeight: 600 }}>%{progress}</span>
                          </div>
                          <div className="progress">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: 10, marginTop: 2 }}>
                          <span className={`badge ${c.status}`}>
                            {STATUS_LABELS[c.status as StudentStatus] ?? c.status}
                            {c.latestScore !== null ? ` (Puan: %${c.latestScore})` : ""}
                          </span>

                          <Link
                            href={`/ogrenci/gorevler/${c.id}`}
                            className={`button ${isDone ? "ghost" : "primary"}`}
                            style={{ minHeight: 32, padding: "4px 14px", fontSize: "0.85rem" }}
                          >
                            {isDone ? "Föyü İncele →" : "Hazırlığa Başla →"}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
