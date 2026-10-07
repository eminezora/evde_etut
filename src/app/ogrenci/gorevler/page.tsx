import Link from "next/link";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentDashboard, type DashboardCategory } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, stepIndex, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { listStudentClassrooms } from "@/lib/accounts/account-service.ts";
import { JoinClassroomForm } from "@/components/student/JoinClassroomForm.tsx";

const SECTIONS: { key: DashboardCategory; title: string; icon: string; empty: string }[] = [
  { key: "UPCOMING", title: "Yaklaşan Görevler", icon: "📌", empty: "Şu an yeni bir görev bulunmuyor. Harika durumdasın!" },
  { key: "IN_PROGRESS", title: "Devam Edenler", icon: "⏳", empty: "Yarım kalmış bir çalışman yok." },
  { key: "NEEDS_REVIEW", title: "Tekrar Gerekli", icon: "🔄", empty: "Tekrar etmen gereken bir konu yok." },
  { key: "READY", title: "Derse Hazırım", icon: "✅", empty: "Henüz tamamlanan bir çalışma yok." },
  { key: "EXPIRED", title: "Süresi Geçmiş", icon: "⚠️", empty: "Süresi geçmiş bir görev bulunmuyor." },
];

export default async function StudentDashboardPage() {
  const student = await requireStudent();
  const [cards, classrooms] = await Promise.all([getStudentDashboard(student.id), listStudentClassrooms(student.id)]);

  const readyCount = cards.filter((c) => c.category === "READY").length;
  const inProgressCount = cards.filter((c) => c.category === "IN_PROGRESS" || c.category === "UPCOMING").length;

  return (
    <>
      {classrooms.length === 0 && (
        <div className="card join-card" role="region" aria-labelledby="join-title">
          <div className="join-card-icon" aria-hidden="true">🏫</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="join-title" style={{ margin: "0 0 4px" }}>Sınıfa Katıl</h2>
            <p className="muted" style={{ margin: "0 0 4px" }}>
              Henüz bir sınıfa bağlı değilsin. Öğretmeninin verdiği 8 karakterlik sınıf kodunu yazarak sınıfına katıl; görevlerin burada görünecek.
            </p>
            <JoinClassroomForm />
          </div>
        </div>
      )}

      {/* Student Welcome Hero Card */}
      <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-subtle) 100%)", border: "1px solid var(--accent-border)", padding: "28px 24px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className="badge READY">● Aktif Öğrenci</span>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {classrooms.length} sınıfa kayıtlı
              </span>
            </div>
            <h1 style={{ fontSize: "1.85rem", margin: "0 0 6px" }}>
              Merhaba, {student.name}! 👋
            </h1>
            <p className="muted" style={{ margin: 0, fontSize: "0.95rem", maxWidth: 640 }}>
              Yarınki derslerin için öğretmeninin hazırladığı 5 dakikalık özetleri oku, mini testi çöz ve derse tam hazır gir!
            </p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="stat" style={{ textAlign: "center", minWidth: 90, padding: "8px 14px", background: "var(--surface)" }}>
              <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 700 }}>HAZIR</span>
              <strong style={{ color: "var(--ok)", fontSize: "1.3rem" }}>{readyCount}</strong>
            </div>
            <div className="stat" style={{ textAlign: "center", minWidth: 90, padding: "8px 14px", background: "var(--surface)" }}>
              <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 700 }}>BEKLEYEN</span>
              <strong style={{ color: "var(--accent)", fontSize: "1.3rem" }}>{inProgressCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Classroom Join & List Card */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Kayıtlı Olduğum Sınıflar</h2>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {classrooms.length ? `${classrooms.length} sınıf` : "Henüz sınıf yok"}
          </span>
        </div>

        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          {classrooms.length ? (
            classrooms.map((c) => (
              <span key={c.id} className="badge" style={{ padding: "6px 12px", fontSize: "0.88rem", background: "var(--surface-subtle)" }}>
                🏫 <strong>{c.name}</strong> · {c.teacher.name}
              </span>
            ))
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
              Öğretmeninin verdiği katılma kodunu girerek sınıfına katılabilirsin.
            </p>
          )}
        </div>

        {classrooms.length > 0 && (
          <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <JoinClassroomForm />
          </div>
        )}
      </div>

      {/* Grouped Tasks Sections */}
      {SECTIONS.map((s) => {
        const list = cards.filter((c) => c.category === s.key);
        return (
          <section key={s.key} className="dash-section" aria-labelledby={`sec-${s.key}`}>
            <h2 id={`sec-${s.key}`} style={{ fontSize: "1.2rem", marginBottom: 14 }}>
              <span>{s.icon}</span>
              <span>{s.title}</span>
              <span className="badge" style={{ marginLeft: 6, fontSize: "0.8rem" }}>{list.length}</span>
            </h2>

            {list.length === 0 ? (
              <div className="card" style={{ padding: "20px", background: "var(--surface-subtle)", borderStyle: "dashed" }}>
                <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>{s.empty}</p>
              </div>
            ) : (
              <div className="card-grid">
                {list.map((c) => {
                  const progress = Math.round((stepIndex(c.status) / 4) * 100);
                  const isDone = c.status === "READY_FOR_CLASS";
                  return (
                    <Link key={c.id} href={`/ogrenci/gorevler/${c.id}`} className="task-card">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                          {c.subject}
                        </span>
                        <span className="muted" style={{ fontSize: "0.82rem" }}>
                          {c.classroom} · {c.teacher}
                        </span>
                      </div>

                      <strong style={{ fontSize: "1.05rem", lineHeight: 1.35, marginTop: 4 }}>
                        {c.topic}
                      </strong>

                      <div className="row" style={{ gap: 6, fontSize: "0.85rem", color: "var(--muted)" }}>
                        <span>📅 Son tarih:</span>
                        <span>{formatDate(c.deadline)}</span>
                      </div>

                      <div style={{ marginTop: 6 }}>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                          <span className="muted">İlerleme Durumu</span>
                          <span style={{ fontWeight: 600 }}>%{progress}</span>
                        </div>
                        <span
                          className="progress"
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="İlerleme"
                        >
                          <span style={{ width: `${progress}%` }} />
                        </span>
                      </div>

                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                        <span className={`badge ${c.status}`} style={{ fontSize: "0.8rem" }}>
                          {STATUS_LABELS[c.status as StudentStatus] ?? c.status}
                          {c.latestScore !== null ? ` (%${c.latestScore})` : ""}
                        </span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--accent)" }}>
                          {isDone ? "Sonucu Gör →" : "Devam Et →"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
