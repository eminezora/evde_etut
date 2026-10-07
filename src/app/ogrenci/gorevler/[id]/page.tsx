// Assignment overview: task info, progress stepper, introduction and the next action.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentOverview } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ProgressStepper } from "@/components/student/ProgressStepper.tsx";

export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;
  const view = await getStudentOverview(student.id, id);
  if (!view) notFound();
  const { sa, assignment: a, content } = view;
  const s = sa.status;
  const next =
    s === "NOT_STARTED" || s === "READING"
      ? { href: `/ogrenci/gorevler/${id}/ozet`, label: s === "NOT_STARTED" ? "Konu Özetine Başla →" : "Konu Özetine Devam Et →" }
      : s === "READY_FOR_ASSESSMENT" || s === "ASSESSMENT_IN_PROGRESS"
        ? { href: `/ogrenci/gorevler/${id}/calisma`, label: s === "READY_FOR_ASSESSMENT" ? "Ön Bilgi Kontrolüne Geç →" : "Ön Bilgi Kontrolüne Devam Et →" }
        : s === "EXPIRED"
          ? null
          : { href: `/ogrenci/gorevler/${id}/sonuc`, label: "Sonucu ve Raporu Gör →" };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginBottom: 6 }}>
          <Link href="/ogrenci/gorevler">← Görevlerime dön</Link>
        </p>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            {a.subject}
          </span>
          <span className={`badge ${s}`}>
            {STATUS_LABELS[s as StudentStatus] ?? s}
          </span>
        </div>
        <h1 style={{ margin: "4px 0 0" }}>{a.topic}</h1>
      </div>

      <ProgressStepper status={s} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <div className="card">
        <h2>Görev Bilgileri</h2>
        <dl className="details" style={{ marginTop: 12 }}>
          <dt>Ders & Düzey</dt><dd>{a.subject} ({a.grade}. sınıf)</dd>
          <dt>Sınıf & Öğretmen</dt><dd>{a.classroom} · {a.teacher}</dd>
          <dt>Tema / Ünite</dt><dd>{a.unitOrTheme}</dd>
          <dt>Son Teslim Tarihi</dt><dd>{formatDate(a.deadline)}</dd>
          <dt>Derse Hazır Olma Eşiği</dt><dd>%{a.minimumScore}</dd>
          <dt>Ön Bilgi Kontrolü</dt><dd>{a.questionCount} soru · {a.policy.max === null ? "sınırsız deneme" : `${a.policy.used} / ${a.policy.max} deneme kullanıldı`}</dd>
          <dt>Şu Anki Durum</dt><dd><span className={`badge ${s}`}>{STATUS_LABELS[s as StudentStatus] ?? s}</span></dd>
        </dl>
      </div>

      <div className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
        <h2>Konuya Giriş</h2>
        <p style={{ whiteSpace: "pre-wrap", fontSize: "1.05rem", lineHeight: 1.6 }}>
          {content.introduction || "—"}
        </p>
        <div className="info" style={{ marginBottom: 20 }}>
          💡 <strong>Unutma:</strong> Bu çalışmanın amacı konuyu önceden ezberlemen değil; yarın derste öğretmenini rahatça anlayabilmen için temel kavramları hatırlamandır.
        </div>
        {s === "EXPIRED" && <p className="error">Bu görevin son teslim tarihi geçti.</p>}
        {next && (
          <Link className="button primary" href={next.href} style={{ padding: "12px 24px", fontSize: "1rem" }}>
            {next.label}
          </Link>
        )}
      </div>
    </>
  );
}
