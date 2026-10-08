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
      <div style={{ marginBottom: 20 }}>
        <span className="kicker">ÖĞRETMEN DEĞERLENDİRME MASASI</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 2 }}>
          <h1 style={{ margin: 0 }}>Açık Uçlu Cevap Değerlendirmesi</h1>
          <span className="badge" style={{ backgroundColor: items.length > 0 ? "var(--accent-light)" : "var(--ok-bg)", color: items.length > 0 ? "var(--accent)" : "var(--ok-text)" }}>
            {items.length} Bekleyen Yanıt
          </span>
        </div>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.92rem" }}>
          Öğrencilerin açık uçlu yanıtlarını rubrik kriterlerine göre puanlayın; nihai başarı ve derse hazırlık durumu otomatik güncellensin.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="editorial-panel" style={{ textAlign: "center", padding: "48px 20px" }}>
          <h2 style={{ fontSize: "1.3rem", margin: "0 0 6px" }}>Tüm Değerlendirmeler Güncel</h2>
          <p className="muted" style={{ maxWidth: 460, margin: "0 auto", fontSize: "0.92rem" }}>
            Şu anda puanlama bekleyen açık uçlu öğrenci yanıtı bulunmuyor.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {items.map((x) => (
            <div key={x.answerId} className="editorial-panel" style={{ borderLeft: "3px solid var(--accent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>
                    {x.student}
                  </span>
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    {x.assignment.subject} · {x.attemptNumber}. Deneme
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
                <span className="badge" style={{ fontSize: "0.76rem" }}>
                  {QUESTION_TYPE_LABELS[x.question.type as QuestionType]}
                </span>
                <span className="badge" style={{ fontSize: "0.76rem" }}>
                  Maksimum {x.maxPoints} Puan
                </span>
              </div>

              {x.question.context && (
                <blockquote style={{ margin: "8px 0 12px", padding: "10px 14px", borderLeft: "3px solid var(--border-strong)", backgroundColor: "var(--surface-subtle)", fontSize: "0.9rem" }}>
                  {x.question.context}
                </blockquote>
              )}

              <div style={{ padding: "12px 14px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", marginBottom: 12 }}>
                <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>SORU METNİ</span>
                <p style={{ whiteSpace: "pre-wrap", fontWeight: 600, margin: "4px 0 0", fontSize: "0.95rem" }}>{x.question.text}</p>
              </div>

              <div style={{ padding: "12px 14px", backgroundColor: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xs)", marginBottom: 12 }}>
                <span className="kicker" style={{ margin: 0, fontSize: "0.72rem", color: "var(--accent)" }}>ÖĞRENCİNİN YANITI</span>
                <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0", fontSize: "0.98rem", color: "var(--text)" }}>
                  {x.answerText || "— (Boş bırakıldı)"}
                </p>
              </div>

              {x.question.sampleAnswer && (
                <div style={{ fontSize: "0.85rem", marginBottom: 6 }}>
                  <strong className="muted">Örnek Model Yanıt: </strong>
                  <span>{x.question.sampleAnswer}</span>
                </div>
              )}
              {x.question.rubric && (
                <div style={{ fontSize: "0.85rem", marginBottom: 12 }}>
                  <strong className="muted">Değerlendirme Rubriği: </strong>
                  <span>{x.question.rubric}</span>
                </div>
              )}

              <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <ReviewForm answerId={x.answerId} maxPoints={x.maxPoints} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
