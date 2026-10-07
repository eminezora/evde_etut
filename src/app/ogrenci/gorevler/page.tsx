import Link from "next/link";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentDashboard, type DashboardCategory } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, stepIndex, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { listStudentClassrooms } from "@/lib/accounts/account-service.ts";
import { JoinClassroomForm } from "@/components/student/JoinClassroomForm.tsx";

const SECTIONS: { key: DashboardCategory; title: string; empty: string }[] = [
  { key: "UPCOMING", title: "Yaklaşan Görevler", empty: "Yeni görev yok." },
  { key: "IN_PROGRESS", title: "Devam Edenler", empty: "Devam eden görev yok." },
  { key: "NEEDS_REVIEW", title: "Tekrar Gerekli", empty: "Tekrar gereken görev yok." },
  { key: "READY", title: "Derse Hazırım", empty: "Henüz tamamlanan görev yok." },
  { key: "EXPIRED", title: "Süresi Geçmiş", empty: "Süresi geçmiş görev yok." },
];

export default async function StudentDashboardPage() {
  const student = await requireStudent();
  const [cards, classrooms] = await Promise.all([getStudentDashboard(student.id), listStudentClassrooms(student.id)]);
  return (
    <>
      <h1>Görevlerim</h1>
      <p className="muted">Bu çalışmalar, öğretmeninin derste anlatacağı konuyu takip edebilmen için gereken temel ön bilgiyi hazırlar.</p>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <strong>Sınıflarım:</strong>{" "}
          {classrooms.length ? classrooms.map((c) => `${c.name} (${c.teacher.name})`).join(", ") : "Henüz bir sınıfa katılmadın."}
        </p>
        <JoinClassroomForm />
      </div>
      {SECTIONS.map((s) => {
        const list = cards.filter((c) => c.category === s.key);
        return (
          <section key={s.key} className="dash-section" aria-labelledby={`sec-${s.key}`}>
            <h2 id={`sec-${s.key}`}>{s.title} <span className="muted">({list.length})</span></h2>
            {list.length === 0 ? (
              <p className="muted">{s.empty}</p>
            ) : (
              <div className="card-grid">
                {list.map((c) => {
                  const progress = Math.round((stepIndex(c.status) / 4) * 100);
                  return (
                    <Link key={c.id} href={`/ogrenci/gorevler/${c.id}`} className="task-card">
                      <span className="muted">{c.subject} · {c.classroom} · {c.teacher}</span>
                      <strong>{c.topic}</strong>
                      <span>Son tarih: {formatDate(c.deadline)}</span>
                      <span className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="İlerleme">
                        <span style={{ width: `${progress}%` }} />
                      </span>
                      <span>Durum: {STATUS_LABELS[c.status as StudentStatus] ?? c.status}{c.latestScore !== null ? ` · Son puan: %${c.latestScore}` : ""}</span>
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
