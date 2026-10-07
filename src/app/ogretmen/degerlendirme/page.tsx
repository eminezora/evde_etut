import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listPendingReviews } from "@/lib/assessment/review-service.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ReviewForm } from "@/components/teacher/ReviewForm.tsx";

export default async function PendingReviewsPage() {
  const teacher = await requireTeacher();
  const items = await listPendingReviews(teacher.id);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Öğretmen Değerlendirmesi</h1>
          <span className="badge" style={{ background: items.length > 0 ? "var(--accent-light)" : "var(--ok-bg)", color: items.length > 0 ? "var(--accent)" : "var(--ok-text)" }}>
            {items.length} Bekleyen Cevap
          </span>
        </div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.95rem" }}>
          Öğrencilerin açık uçlu cevaplarını değerlendirdiğinizde, nihai puanları otomatik hesaplanır ve &ldquo;Derse Hazır&rdquo; durumu güncellenir.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>🎉</span>
          <h2>Tüm Değerlendirmeler Tamamlandı!</h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto" }}>
            Şu anda puanlanmayı bekleyen açık uçlu öğrenci cevabı bulunmuyor.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {items.map((x) => (
            <div key={x.answerId} className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    {x.student}
                  </span>
                  <span className="muted" style={{ fontSize: "0.88rem" }}>
                    {x.assignment.subject} · {x.attemptNumber}. deneme
                  </span>
                </div>
                {x.submittedAt && (
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    {formatDate(x.submittedAt)}
                  </span>
                )}
              </div>

              <h3 style={{ margin: "4px 0 8px", fontSize: "1.1rem" }}>
                <Link href={`/ogretmen/gorevler/${x.assignment.id}/ogrenci/${x.studentId}`}>
                  {x.assignment.topic}
                </Link>
              </h3>

              <div className="row" style={{ gap: 6, marginBottom: 12 }}>
                <span className="badge" style={{ fontSize: "0.78rem" }}>
                  {QUESTION_TYPE_LABELS[x.question.type as QuestionType]}
                </span>
                <span className="badge" style={{ fontSize: "0.78rem" }}>
                  En fazla {x.maxPoints} puan
                </span>
              </div>

              {x.question.context && <blockquote className="context">{x.question.context}</blockquote>}

              <div style={{ padding: "12px 14px", background: "var(--surface-subtle)", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
                <strong style={{ display: "block", fontSize: "0.9rem", color: "var(--muted)", marginBottom: 4 }}>Soru:</strong>
                <p style={{ whiteSpace: "pre-wrap", fontWeight: 600, margin: 0 }}>{x.question.text}</p>
              </div>

              <div className="info" style={{ marginBottom: 14 }}>
                <strong style={{ display: "block", marginBottom: 4, color: "var(--info-text)" }}>
                  Öğrencinin Yanıtı:
                </strong>
                <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "1rem" }}>
                  {x.answerText || "— (Boş bırakıldı)"}
                </p>
              </div>

              {x.question.sampleAnswer && (
                <div style={{ fontSize: "0.88rem", marginBottom: 8 }}>
                  <strong className="muted">Örnek Model Cevap: </strong>
                  <span>{x.question.sampleAnswer}</span>
                </div>
              )}
              {x.question.rubric && (
                <div style={{ fontSize: "0.88rem", marginBottom: 14 }}>
                  <strong className="muted">Puanlama Ölçütü: </strong>
                  <span>{x.question.rubric}</span>
                </div>
              )}

              <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <ReviewForm answerId={x.answerId} maxPoints={x.maxPoints} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
