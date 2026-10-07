import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getStudentDetail } from "@/lib/assessment/review-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ATTEMPT_STATUS_LABELS, describeAnswer } from "@/lib/assessment/answer-format.ts";

const fmt = (d: Date | null | undefined) => (d ? formatDate(d) : "—");
const REVIEW_LABEL: Record<string, string> = { AUTO_SCORED: "Otomatik", PENDING_REVIEW: "Öğretmen Değerlendirmesi Bekliyor", REVIEWED: "Öğretmen puanladı", UNANSWERED: "Boş", DRAFT: "Taslak" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const teacher = await requireTeacher();
  const { id, studentId } = await params;
  const d = await getStudentDetail(teacher.id, id, studentId);
  if (!d) notFound();
  const sa = d.sa;
  const minutes = sa?.startedAt && sa.completedAt ? Math.round((sa.completedAt.getTime() - sa.startedAt.getTime()) / 60000) : null;
  return (
    <>
      <p><Link href={`/ogretmen/gorevler/${id}/analiz`}>← Analiz</Link></p>
      <h1>{d.student.name} · {d.assignment.topic}</h1>
      <div className="card">
        <dl className="details">
          <dt>Durum</dt><dd>{sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}</dd>
          <dt>Özeti açtı</dt><dd>{fmt(sa?.summaryOpenedAt)}</dd>
          <dt>Özeti onayladı</dt><dd>{fmt(sa?.summaryConfirmedAt)}</dd>
          <dt>Deneme sayısı</dt><dd>{sa?.attemptCount ?? 0}</dd>
          <dt>Son puan / en iyi puan</dt><dd>{sa?.latestScore ?? "—"} / {sa?.bestScore ?? "—"} (eşik %{d.assignment.minimumScore})</dd>
          <dt>Tamamlanma</dt><dd>{fmt(sa?.completedAt)}{minutes !== null ? ` · ilk başlangıçtan ${minutes} dk sonra` : ""}</dd>
        </dl>
      </div>
      {(sa?.attempts ?? []).map((t) => (
        <div key={t.id} className="card">
          <h2>{t.attemptNumber}. deneme <span className="muted">· {ATTEMPT_STATUS_LABELS[t.status] ?? t.status} · {fmt(t.submittedAt)}</span></h2>
          <p className="muted">Nihai: {t.finalScore ?? "—"} · Otomatik: {t.autoScore ?? "—"} · Öğretmen: {t.manualScore ?? "—"} · {t.earnedPoints ?? 0}/{t.totalPoints ?? "—"} puan</p>
          <ol>
            {t.answers.map((x) => (
              <li key={x.id} style={{ marginBottom: 8 }}>
                <span className="muted">{QUESTION_TYPE_LABELS[x.question.type as QuestionType]} · {REVIEW_LABEL[x.reviewStatus] ?? x.reviewStatus} · {x.awardedPoints ?? "—"}/{x.question.points}</span>
                <p style={{ margin: "2px 0" }}>{x.question.questionText}</p>
                <p className="info" style={{ margin: "2px 0" }}>Cevap: {describeAnswer(x.question.type, x.question.data, x.answer)}</p>
                {x.teacherFeedback && <p className="info">Geri bildirim: {x.teacherFeedback}</p>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}
