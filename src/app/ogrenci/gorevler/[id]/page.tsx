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
      ? { href: `/ogrenci/gorevler/${id}/ozet`, label: s === "NOT_STARTED" ? "Konu Özetine Başla" : "Konu Özetine Devam Et" }
      : s === "READY_FOR_ASSESSMENT" || s === "ASSESSMENT_IN_PROGRESS"
        ? { href: `/ogrenci/gorevler/${id}/calisma`, label: s === "READY_FOR_ASSESSMENT" ? "Ön Bilgi Kontrolüne Geç" : "Ön Bilgi Kontrolüne Devam Et" }
        : s === "EXPIRED"
          ? null
          : { href: `/ogrenci/gorevler/${id}/sonuc`, label: "Sonucu Gör" };

  return (
    <>
      <p><Link href="/ogrenci/gorevler">← Görevlerim</Link></p>
      <h1>{a.topic}</h1>
      <ProgressStepper status={s} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />
      <div className="card">
        <dl className="details">
          <dt>Ders</dt><dd>{a.subject} ({a.grade}. sınıf)</dd>
          <dt>Sınıf</dt><dd>{a.classroom} · {a.teacher}</dd>
          <dt>Tema/Ünite</dt><dd>{a.unitOrTheme}</dd>
          <dt>Son tarih</dt><dd>{formatDate(a.deadline)}</dd>
          <dt>Derse hazır olma eşiği</dt><dd>%{a.minimumScore}</dd>
          <dt>Ön bilgi kontrolü</dt><dd>{a.questionCount} soru · {a.policy.max === null ? "sınırsız deneme" : `${a.policy.used} / ${a.policy.max} deneme kullanıldı`}</dd>
          <dt>Durum</dt><dd>{STATUS_LABELS[s as StudentStatus] ?? s}</dd>
        </dl>
      </div>
      <div className="card">
        <h2>Konuya Giriş</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{content.introduction || "—"}</p>
        <p className="muted">Bu çalışmanın amacı konuyu tamamen öğrenmen değil; derste öğretmenini rahatça takip edebilmen için temel ön bilgiyi edinmen.</p>
        {s === "EXPIRED" && <p className="error">Bu görevin son tarihi geçti.</p>}
        {next && <Link className="button primary" href={next.href}>{next.label}</Link>}
      </div>
    </>
  );
}
