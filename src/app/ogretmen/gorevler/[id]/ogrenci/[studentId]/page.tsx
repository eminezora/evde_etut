import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getStudentDetail } from "@/lib/assessment/review-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ATTEMPT_STATUS_LABELS, describeAnswer } from "@/lib/assessment/answer-format.ts";

const fmt = (d: Date | null | undefined) => (d ? formatDate(d) : "—");
const REVIEW_LABEL: Record<string, string> = {
  AUTO_SCORED: "Otomatik",
  PENDING_REVIEW: "Öğretmen Değerlendirmesi Bekliyor",
  REVIEWED: "Öğretmen puanladı",
  UNANSWERED: "Boş",
  DRAFT: "Taslak",
};

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const teacher = await requireTeacher();
  const { id, studentId } = await params;
  const d = await getStudentDetail(teacher.id, id, studentId);
  if (!d) notFound();
  const sa = d.sa;
  const minutes = sa?.startedAt && sa.completedAt ? Math.round((sa.completedAt.getTime() - sa.startedAt.getTime()) / 60000) : null;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 6 }}>
          <Link href={`/ogretmen/gorevler/${id}/analiz`}>← Analiz Raporuna Dön</Link>
        </p>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                Öğrenci İncelemesi
              </span>
              <span className="badge">
                {sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}
              </span>
            </div>
            <h1 style={{ margin: "4px 0 0" }}>{d.student.name} · {d.assignment.topic}</h1>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Öğrenci Hazırlık Özeti</h2>
        <dl className="details" style={{ marginTop: 12 }}>
          <dt>Durum</dt><dd>{sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}</dd>
          <dt>Özeti Açtı</dt><dd>{fmt(sa?.summaryOpenedAt)}</dd>
          <dt>Özeti Onayladı</dt><dd>{fmt(sa?.summaryConfirmedAt)}</dd>
          <dt>Deneme Sayısı</dt><dd>{sa?.attemptCount ?? 0}</dd>
          <dt>Son Puan / En İyi Puan</dt><dd>{sa?.latestScore !== null && sa?.latestScore !== undefined ? `%${sa.latestScore}` : "—"} / {sa?.bestScore !== null && sa?.bestScore !== undefined ? `%${sa.bestScore}` : "—"} (Eşik %{d.assignment.minimumScore})</dd>
          <dt>Tamamlanma Süresi</dt><dd>{fmt(sa?.completedAt)}{minutes !== null ? ` · ilk başlangıçtan ${minutes} dk sonra` : ""}</dd>
        </dl>
      </div>

      {(sa?.attempts ?? []).map((t) => (
        <div key={t.id} className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2>{t.attemptNumber}. Deneme</h2>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">{ATTEMPT_STATUS_LABELS[t.status] ?? t.status}</span>
              <span className="muted" style={{ fontSize: "0.85rem" }}>{fmt(t.submittedAt)}</span>
            </div>
          </div>

          <div className="row" style={{ gap: 12, marginBottom: 16 }}>
            <span className="stat" style={{ padding: "8px 14px" }}>
              <span className="muted" style={{ fontSize: "0.75rem" }}>NİHAİ PUAN</span>
              <strong>{t.finalScore !== null && t.finalScore !== undefined ? `%${t.finalScore}` : "—"}</strong>
            </span>
            <span className="stat" style={{ padding: "8px 14px" }}>
              <span className="muted" style={{ fontSize: "0.75rem" }}>OTOMATİK</span>
              <strong>{t.autoScore !== null && t.autoScore !== undefined ? `%${t.autoScore}` : "—"}</strong>
            </span>
            <span className="stat" style={{ padding: "8px 14px" }}>
              <span className="muted" style={{ fontSize: "0.75rem" }}>ÖĞRETMEN</span>
              <strong>{t.manualScore !== null && t.manualScore !== undefined ? `%${t.manualScore}` : "—"}</strong>
            </span>
            <span className="stat" style={{ padding: "8px 14px" }}>
              <span className="muted" style={{ fontSize: "0.75rem" }}>TOPLAM PUAN</span>
              <strong>{t.earnedPoints ?? 0}/{t.totalPoints ?? "—"}</strong>
            </span>
          </div>

          <ol style={{ paddingLeft: "1.2rem", margin: 0, display: "grid", gap: 16 }}>
            {t.answers.map((x) => (
              <li key={x.id} style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="badge" style={{ fontSize: "0.78rem" }}>{QUESTION_TYPE_LABELS[x.question.type as QuestionType]}</span>
                  <span className="badge" style={{ fontSize: "0.78rem" }}>{REVIEW_LABEL[x.reviewStatus] ?? x.reviewStatus}</span>
                  <span className="code" style={{ fontSize: "0.78rem" }}>{x.awardedPoints ?? "—"} / {x.question.points} puan</span>
                </div>
                <p style={{ fontWeight: 600, margin: "4px 0 8px" }}>{x.question.questionText}</p>
                <div className="info" style={{ margin: "6px 0" }}>
                  <strong>Cevap: </strong>
                  <span>{describeAnswer(x.question.type, x.question.data, x.answer)}</span>
                </div>
                {x.teacherFeedback && (
                  <div style={{ marginTop: 6, fontSize: "0.88rem", color: "var(--ok-text)" }}>
                    <strong>Öğretmen Geri Bildirimi: </strong>
                    <span>{x.teacherFeedback}</span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}
