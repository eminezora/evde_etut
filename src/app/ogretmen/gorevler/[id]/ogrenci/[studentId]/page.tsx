// Öğrenci cevap kağıdı: every attempt and every answer of one student on one assignment.
// Editorial Learning Workspace Answer Sheet Design.
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

export default async function AnswerSheetPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const teacher = await requireTeacher();
  const { id, studentId } = await params;
  const d = await getStudentDetail(teacher.id, id, studentId);
  if (!d) notFound();
  const sa = d.sa;
  const attempts = [...(sa?.attempts ?? [])].reverse(); // newest first

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          <Link href={`/ogretmen/gorevler/${id}/analiz`} style={{ textDecoration: "none" }}>← Görev Raporuna Dön</Link>
          {" · "}
          <Link href={`/ogretmen/ogrenciler/${studentId}`} style={{ textDecoration: "none" }}>Öğrenci Gelişim Geçmişi</Link>
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <span className="kicker">DEĞERLENDİRME VE CEVAP KAĞIDI</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: "2px 0 4px" }}>{d.student.name}</h1>
            <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
              {d.assignment.topic} · {d.assignment.subject} · {d.assignment.classroom.name}
            </p>
          </div>
          <span className={`badge ${sa?.status === "READY_FOR_CLASS" ? "READY" : sa?.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : ""}`}>
            {sa ? STATUS_LABELS[sa.status as StudentStatus] ?? sa.status : "Başlamadı"}
          </span>
        </div>
      </div>

      {/* Editorial Summary Strip */}
      <div className="editorial-metrics" style={{ marginBottom: 24 }}>
        <div className="metric-item">
          <div className="metric-value">
            {pct(sa?.latestScore)}
          </div>
          <div className="metric-label">Sonuç Puanı</div>
          <div className="metric-desc">Hedef başarı eşiği: %{d.assignment.minimumScore}</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">
            {sa?.attemptCount ?? 0}
          </div>
          <div className="metric-label">Deneme Sayısı</div>
          <div className="metric-desc">Toplam yapılan deneme</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ fontSize: "1.4rem" }}>
            {fmt(sa?.completedAt)}
          </div>
          <div className="metric-label">Tamamlama Tarihi</div>
          <div className="metric-desc">Ön bilgi kontrolü bitişi</div>
        </div>
      </div>

      {attempts.length === 0 && (
        <div className="editorial-panel" style={{ textAlign: "center", padding: "36px" }}>
          <p className="muted" style={{ margin: 0 }}>Öğrenci henüz ön bilgi kontrolü denemesi başlatmadı.</p>
        </div>
      )}

      {attempts.map((t) => {
        const ready = t.finalScore !== null && t.finalScore >= d.assignment.minimumScore;
        return (
          <div key={t.id} className="editorial-panel" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong style={{ fontSize: "1.1rem" }}>{t.attemptNumber}. Deneme Cevap Kağıdı</strong>
                <span className="muted" style={{ fontSize: "0.82rem", marginLeft: 10 }}>
                  Gönderim: {fmt(t.submittedAt)}
                </span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="badge">{ATTEMPT_STATUS_LABELS[t.status] ?? t.status}</span>
                {t.finalScore !== null && (
                  <span className={`badge ${ready ? "READY" : "NEEDS_REVIEW"}`}>
                    {ready ? "Derse Hazır (% " + t.finalScore + ")" : "Tekrar Gerekli (% " + t.finalScore + ")"}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: "10px 14px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)", marginBottom: 18, fontSize: "0.85rem" }}>
              <div><strong>Kazanılan Puan:</strong> {t.earnedPoints ?? 0} / {t.totalPoints ?? "—"} puan</div>
              <div><strong>Otomatik Puan:</strong> {pct(t.autoScore)}</div>
              <div><strong>Öğretmen Puanı:</strong> {pct(t.manualScore)}</div>
            </div>

            {/* Answer List formatted as authentic exam paper */}
            <div style={{ display: "grid", gap: 16 }}>
              {t.answers.map((x, n) => {
                const state = answerState(x, x.question.points);
                const correct = describeCorrectAnswer(x.question.type, x.question.data);
                const auto = isAutoScored(x.question.type, x.question.data);
                const isCorrect = state === "CORRECT";
                const isPending = state === "PENDING";
                const isPartial = state === "PARTIAL";

                return (
                  <div
                    key={x.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderLeft: `4px solid ${isCorrect ? "var(--ok)" : isPending ? "var(--accent)" : isPartial ? "var(--warn)" : "var(--danger)"}`,
                      borderRadius: "var(--radius-xs)",
                      padding: "16px 18px",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <strong>Soru {n + 1}</strong>
                        <span className="badge">{QUESTION_TYPE_LABELS[x.question.type as QuestionType] ?? x.question.type}</span>
                        <span className="badge" style={{ backgroundColor: isCorrect ? "var(--ok-bg)" : isPending ? "var(--accent-light)" : "var(--danger-bg)", color: isCorrect ? "var(--ok-text)" : isPending ? "var(--accent)" : "var(--danger-text)" }}>
                          {ANSWER_STATE_LABELS[state]}
                        </span>
                      </div>
                      <span className="code">
                        {x.awardedPoints ?? "—"} / {x.question.points} Puan {auto ? "(Otomatik)" : x.reviewStatus === "REVIEWED" ? "(Öğretmen)" : ""}
                      </span>
                    </div>

                    <p style={{ fontWeight: 600, margin: "6px 0 12px", whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
                      {x.question.questionText}
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
                      <div style={{ padding: "10px 12px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
                        <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>ÖĞRENCİNİN CEVABI</span>
                        <p style={{ margin: "4px 0 0", fontSize: "0.92rem", color: "var(--text)" }}>
                          {describeAnswer(x.question.type, x.question.data, x.answer)}
                        </p>
                      </div>

                      <div style={{ padding: "10px 12px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
                        <span className="kicker" style={{ margin: 0, fontSize: "0.72rem", color: "var(--ok)" }}>{correct.label}</span>
                        <p style={{ margin: "4px 0 0", fontSize: "0.92rem", color: "var(--text)" }}>
                          {correct.text}
                        </p>
                      </div>
                    </div>

                    {x.teacherFeedback && (
                      <div style={{ marginTop: 8, padding: "8px 12px", backgroundColor: "var(--ok-bg)", border: "1px solid var(--ok-border)", borderRadius: "var(--radius-xs)", fontSize: "0.88rem", color: "var(--ok-text)" }}>
                        <strong>Öğretmen Notu:</strong> {x.teacherFeedback}
                      </div>
                    )}

                    {!auto && t.status === "PENDING_TEACHER_REVIEW" && (x.reviewStatus === "PENDING_REVIEW" || x.reviewStatus === "REVIEWED") && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                        <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                          {x.reviewStatus === "PENDING_REVIEW" ? "Bu açık uçlu cevabı puanlayın." : "Puanı değiştirebilirsiniz."} En fazla {x.question.points} puan.
                        </p>
                        <ReviewForm answerId={x.id} maxPoints={x.question.points} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
