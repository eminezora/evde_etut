// Öğrenci cevap kağıdı: every attempt and every answer of one student on one assignment.
// Access is enforced in getStudentDetail (own assignment + student is in that classroom).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getStudentDetail } from "@/lib/assessment/review-service.ts";
import { isAutoScored } from "@/lib/assessment/scoring-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ANSWER_STATE_LABELS, ATTEMPT_STATUS_LABELS, answerState, describeAnswer, describeCorrectAnswer } from "@/lib/assessment/answer-format.ts";
import { ReviewForm } from "@/components/teacher/ReviewForm.tsx";

const fmt = (d: Date | null | undefined) => (d ? formatDate(d) : "—");
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `%${n}`);
const STATE_CLASS: Record<string, string> = { CORRECT: "is-ok", PARTIAL: "is-warn", INCORRECT: "is-bad", UNANSWERED: "is-bad", PENDING: "is-pending" };

export default async function AnswerSheetPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const teacher = await requireTeacher();
  const { id, studentId } = await params;
  const d = await getStudentDetail(teacher.id, id, studentId);
  if (!d) notFound();
  const sa = d.sa;
  const attempts = [...(sa?.attempts ?? [])].reverse(); // newest first

  return (
    <>
      <p className="muted" style={{ marginBottom: 6 }}>
        <Link href={`/ogretmen/gorevler/${id}/analiz`}>← Görev raporuna dön</Link>
        {" · "}
        <Link href={`/ogretmen/ogrenciler/${studentId}`}>Öğrencinin geçmişi</Link>
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
        <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>Cevap Kağıdı</span>
        <span className="badge">{sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}</span>
      </div>
      <h1 style={{ margin: "4px 0 4px" }}>{d.student.name}</h1>
      <p className="muted" style={{ margin: "0 0 16px" }}>{d.assignment.topic} · {d.assignment.subject} · {d.assignment.classroom.name}</p>

      <div className="card">
        <h2>Özet</h2>
        <dl className="details" style={{ marginTop: 12 }}>
          <dt>Durum</dt><dd>{sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}</dd>
          <dt>Özeti açtı / onayladı</dt><dd>{fmt(sa?.summaryOpenedAt)} / {fmt(sa?.summaryConfirmedAt)}</dd>
          <dt>Deneme sayısı</dt><dd>{sa?.attemptCount ?? 0}</dd>
          <dt>Son / en iyi puan</dt><dd>{pct(sa?.latestScore)} / {pct(sa?.bestScore)} (derse hazır eşiği %{d.assignment.minimumScore})</dd>
          <dt>Tamamlama</dt><dd>{fmt(sa?.completedAt)}</dd>
        </dl>
      </div>

      {attempts.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Öğrenci henüz ön bilgi kontrolünü çözmeye başlamadı.</p></div>}

      {attempts.map((t, idx) => {
        const ready = t.finalScore !== null && t.finalScore >= d.assignment.minimumScore;
        return (
          <details key={t.id} className="card attempt-sheet" open={idx === 0}>
            <summary>
              <span className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                <strong style={{ fontSize: "1.1rem" }}>{t.attemptNumber}. Deneme</strong>
                <span className="row" style={{ gap: 8 }}>
                  <span className="badge">{ATTEMPT_STATUS_LABELS[t.status] ?? t.status}</span>
                  {t.finalScore !== null && <span className={`badge ${ready ? "READY" : ""}`}>{ready ? "Derse Hazır" : "Tekrar Gerekli"}</span>}
                </span>
              </span>
            </summary>

            <dl className="details" style={{ margin: "12px 0 16px" }}>
              <dt>Başlama / gönderim</dt><dd>{fmt(t.startedAt)} / {fmt(t.submittedAt)}</dd>
              <dt>Toplam puan</dt><dd>{t.earnedPoints ?? 0} / {t.totalPoints ?? "—"} puan · nihai {pct(t.finalScore)}</dd>
              <dt>Otomatik / öğretmen</dt><dd>{pct(t.autoScore)} / {pct(t.manualScore)}</dd>
            </dl>

            <ol className="answer-list">
              {t.answers.map((x, n) => {
                const state = answerState(x, x.question.points);
                const correct = describeCorrectAnswer(x.question.type, x.question.data);
                const auto = isAutoScored(x.question.type, x.question.data);
                return (
                  <li key={x.id} className={`answer-item ${STATE_CLASS[state] ?? ""}`}>
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      <strong>{n + 1}.</strong>
                      <span className="badge">{QUESTION_TYPE_LABELS[x.question.type as QuestionType] ?? x.question.type}</span>
                      <span className={`answer-state ${STATE_CLASS[state] ?? ""}`}>{ANSWER_STATE_LABELS[state]}</span>
                      <span className="code" style={{ marginLeft: "auto" }}>
                        {x.awardedPoints ?? "—"} / {x.question.points} puan {auto ? "(otomatik)" : x.reviewStatus === "REVIEWED" ? "(öğretmen)" : ""}
                      </span>
                    </div>
                    <p style={{ fontWeight: 600, margin: "4px 0 8px", whiteSpace: "pre-wrap" }}>{x.question.questionText}</p>
                    <div className="answer-grid">
                      <div><span className="muted">Öğrencinin cevabı</span><p>{describeAnswer(x.question.type, x.question.data, x.answer)}</p></div>
                      <div><span className="muted">{correct.label}</span><p>{correct.text}</p></div>
                    </div>
                    {x.teacherFeedback && (
                      <p style={{ margin: "8px 0 0", fontSize: "0.9rem", color: "var(--ok-text)" }}><strong>Öğretmen notu:</strong> {x.teacherFeedback}</p>
                    )}
                    {!auto && t.status === "PENDING_TEACHER_REVIEW" && (x.reviewStatus === "PENDING_REVIEW" || x.reviewStatus === "REVIEWED") && (
                      <div className="review-box">
                        <p className="muted" style={{ margin: "0 0 4px", fontSize: "0.85rem" }}>
                          {x.reviewStatus === "PENDING_REVIEW" ? "Bu açık uçlu cevabı puanlayın." : "Puanı değiştirebilirsiniz (deneme hâlâ değerlendirme bekliyor)."} En fazla {x.question.points} puan.
                        </p>
                        <ReviewForm answerId={x.id} maxPoints={x.question.points} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </>
  );
}
