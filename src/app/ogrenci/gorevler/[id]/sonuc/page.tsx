// Result of the latest submitted attempt. The final score and READY_FOR_CLASS / NEEDS_REVIEW
// were decided on the server; correct answers appear only if the assignment policy allows.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { MESSAGES, getResultView } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { ProgressStepper } from "@/components/student/ProgressStepper.tsx";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;
  const r = await getResultView(student.id, id);
  if (!r) notFound();
  const { sa, attempt, minimumScore, policy, recommendations } = r;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/ogrenci/gorevler/${id}`} style={{ textDecoration: "none", color: "var(--muted)", fontWeight: 500, fontSize: "0.92rem" }}>
          ← Görev Detayına Dön
        </Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 6 }}>Değerlendirme Sonucu</h1>
        <p className="muted" style={{ margin: 0 }}>
          Ön bilgi kontrolü çalışmanın sonuçları ve derse hazırlık durumun.
        </p>
      </div>

      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      {!attempt ? (
        <div className="card"><p className="muted">Henüz gönderilmiş bir çalışma yok.</p></div>
      ) : attempt.pending ? (
        <div className="card result pending" role="status">
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>⏳</div>
          <h2 style={{ fontSize: "1.4rem", color: "var(--accent)", margin: "0 0 8px" }}>Öğretmen Değerlendirmesi Bekleniyor</h2>
          <p style={{ maxWidth: 540, margin: "0 auto", color: "var(--muted)" }}>{MESSAGES.pendingMessage}</p>
        </div>
      ) : sa.status === "READY_FOR_CLASS" ? (
        <div className="card result ready" role="status">
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🎉</div>
          <p className="result-title">Derse Hazırsın!</p>
          <p style={{ maxWidth: 560, margin: "0 auto", color: "var(--text)" }}>
            Bu konu için gerekli temel ön bilgiyi başarıyla oluşturdun. Sınıftaki dersi kolaylıkla takip edebilirsin.
          </p>
        </div>
      ) : (
        <div className="card result review" role="status">
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📚</div>
          <p className="result-title">Biraz Daha Hazırlığa İhtiyacın Var</p>
          <p style={{ maxWidth: 560, margin: "0 auto", color: "var(--text)" }}>
            Bazı temel kavramları tekrar gözden geçirip konu özetini inceleyerek yeniden deneyebilirsin.
          </p>
        </div>
      )}

      {attempt && (
        <div className="card">
          <h2 style={{ fontSize: "1.15rem", marginBottom: 16 }}>Performans Özeti</h2>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="stat">
              <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>Puanın</span>
              <strong style={{ fontSize: "1.6rem", color: "var(--accent)" }}>
                {attempt.finalScore === null ? "—" : `%${attempt.finalScore}`}
              </strong>
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                {attempt.finalScore === null ? "Öğretmen bekleniyor" : `Hedef: %${minimumScore}`}
              </span>
            </div>
            <div className="stat">
              <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>Hazır Bulunuşluk Durumu</span>
              <strong style={{ fontSize: "1.1rem", marginTop: 4, display: "block" }}>
                {STATUS_LABELS[sa.status as StudentStatus] ?? sa.status}
              </strong>
            </div>
            <div className="stat">
              <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>Deneme Bilgisi</span>
              <strong style={{ fontSize: "1.3rem" }}>{attempt.attemptNumber}. Deneme</strong>
              <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>
                {policy.max !== null ? `Toplam: ${policy.used} / ${policy.max}` : "Sınırsız hak"}
              </span>
            </div>
            <div className="stat">
              <span className="muted" style={{ fontSize: "0.82rem", display: "block" }}>Doğru / Yanlış Dağılımı</span>
              {!attempt.pending ? (
                <>
                  <strong style={{ fontSize: "1.2rem", color: "var(--ok)" }}>{attempt.correctCount} Doğru</strong>
                  <span className="muted" style={{ fontSize: "0.78rem", display: "block" }}>{attempt.incorrectCount} Yanlış / Eksik</span>
                </>
              ) : (
                <strong style={{ fontSize: "1.1rem", color: "var(--accent)" }}>{attempt.pendingCount} Açık Uçlu Soru</strong>
              )}
            </div>
          </div>
        </div>
      )}

      {recommendations && (recommendations.outcomes.length > 0 || recommendations.concepts.length > 0) && (
        <div className="card">
          <h2 style={{ fontSize: "1.15rem", marginBottom: 12 }}>Tekrar Bakmanı Öneriyoruz</h2>
          <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 16 }}>
            Eksik kalan noktaları tamamlamak için aşağıdaki kavramlara ve kazanımlara odaklanabilirsin.
          </p>

          {recommendations.concepts.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: "0.95rem", color: "var(--text)", marginBottom: 8 }}>📌 Temel Kavramlar</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {recommendations.concepts.map((k) => (
                  <div key={k.term} style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                    <strong style={{ color: "var(--accent)", display: "block", marginBottom: 2 }}>{k.term}</strong>
                    <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{k.explanation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recommendations.outcomes.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: "0.95rem", color: "var(--text)", marginBottom: 8 }}>🎯 İlgili Öğrenme Çıktıları</h3>
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                {recommendations.outcomes.map((o) => (
                  <li key={o.code} style={{ fontSize: "0.92rem" }}>
                    <span className="code" style={{ marginRight: 6 }}>{o.code}</span>
                    <span>{o.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Link className="button" href={`/ogrenci/gorevler/${id}/ozet`}>
              📖 Konu Özetini İncele →
            </Link>
          </div>
        </div>
      )}

      {attempt && attempt.questions.some((q) => q.isCorrect !== null || q.explanation || q.correctAnswer || q.teacherFeedback) && (
        <div className="card">
          <h2 style={{ fontSize: "1.15rem", marginBottom: 16 }}>Soru Bazında Geri Bildirim</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {attempt.questions.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <span className="badge">{QUESTION_TYPE_LABELS[q.type as QuestionType]} · Soru {i + 1}</span>
                  {q.isCorrect !== null && (
                    <span
                      className="badge"
                      style={{
                        background: q.isCorrect ? "var(--ok-bg)" : (q.awardedPoints ?? 0) > 0 ? "var(--warn-bg)" : "var(--danger-bg)",
                        color: q.isCorrect ? "var(--ok-text)" : (q.awardedPoints ?? 0) > 0 ? "var(--warn-text)" : "var(--danger-text)",
                        borderColor: q.isCorrect ? "var(--ok-border)" : (q.awardedPoints ?? 0) > 0 ? "var(--warn-border)" : "var(--danger-border)",
                      }}
                    >
                      {q.isCorrect ? "✓ Doğru" : (q.awardedPoints ?? 0) > 0 ? "◐ Kısmen Doğru" : "✗ Yanlış / Boş"}
                      {q.awardedPoints !== null ? ` (${q.awardedPoints} / ${q.points} p)` : ""}
                    </span>
                  )}
                </div>
                <p style={{ margin: "6px 0 10px", fontWeight: 500, whiteSpace: "pre-wrap" }}>{q.questionText}</p>
                {q.correctAnswer && (
                  <div style={{ fontSize: "0.9rem", color: "var(--ok-text)", background: "var(--ok-bg)", padding: "6px 12px", borderRadius: "var(--radius-sm)", marginBottom: 6 }}>
                    <strong>Doğru Cevap:</strong> {q.correctAnswer}
                  </div>
                )}
                {q.explanation && (
                  <p className="muted" style={{ margin: "4px 0", fontSize: "0.88rem" }}>
                    💡 <em>{q.explanation}</em>
                  </p>
                )}
                {q.teacherFeedback && (
                  <div className="info" style={{ marginTop: 8 }}>
                    <strong>Öğretmeninin Notu:</strong> {q.teacherFeedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sa.status === "NEEDS_REVIEW" && (
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          {policy.limitReached ? (
            <p className="error" style={{ margin: 0 }}>Bu görev için izin verilen maksimum deneme sayısını tamamladın.</p>
          ) : (
            <div>
              <p className="muted" style={{ marginBottom: 14 }}>Konu özetini gözden geçirip hazır hissettiğinde tekrar deneyebilirsin.</p>
              <Link className="button primary" href={`/ogrenci/gorevler/${id}/calisma`}>
                🔄 Tekrar Çalış ve Yeniden Dene
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
