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
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href={`/ogrenci/gorevler/${id}`} style={{ textDecoration: "none" }}>
            ← Görev Detayına Dön
          </Link>
        </p>
        <div className="editorial-kicker">DEĞERLENDİRME DOSYASI</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>
          Ön Hazırlık Sonucu
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Ön bilgi kontrolü çalışmasının analizi, hazır bulunuşluk durumu ve öneriler.
        </p>
      </div>

      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <div style={{ marginTop: 24, display: "grid", gap: 20 }}>
        {!attempt ? (
          <div className="editorial-panel" style={{ padding: 24 }}>
            <p className="muted" style={{ margin: 0 }}>Henüz gönderilmiş bir çalışma kaydı bulunmuyor.</p>
          </div>
        ) : attempt.pending ? (
          <div className="editorial-panel" style={{ borderLeft: "4px solid var(--accent)", padding: "24px 28px" }} role="status">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span className="editorial-kicker" style={{ color: "var(--accent)" }}>DEĞERLENDİRME SÜRECİNDE</span>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", margin: "4px 0" }}>
                  Öğretmen Değerlendirmesi Bekleniyor
                </h2>
              </div>
              <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>İncelemede</span>
            </div>
            <p style={{ maxWidth: 620, margin: 0, color: "var(--text)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              {MESSAGES.pendingMessage}
            </p>
          </div>
        ) : sa.status === "READY_FOR_CLASS" ? (
          <div className="editorial-panel" style={{ borderLeft: "4px solid var(--leaf)", padding: "24px 28px" }} role="status">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span className="editorial-kicker" style={{ color: "var(--leaf)" }}>HAZIR BULUNUŞLUK TAMAMLANDI</span>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", margin: "4px 0", color: "var(--ink)" }}>
                  Derse Hazırsın
                </h2>
              </div>
              <span className="badge READY">Hazır Bulunuşluk Eşiği Aşıldı</span>
            </div>
            <p style={{ maxWidth: 640, margin: 0, color: "var(--text)", lineHeight: 1.65, fontSize: "0.98rem" }}>
              Bu konu için hedeflenen temel ön bilgiyi başarıyla edindiniz. Sınıfta işlenecek dersi ve kavramsal tartışmaları rahatlıkla takip edebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="editorial-panel" style={{ borderLeft: "4px solid var(--amber)", padding: "24px 28px" }} role="status">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span className="editorial-kicker" style={{ color: "var(--amber)" }}>ÖN BİLGİ PEKİŞTİRME GEREKLİ</span>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", margin: "4px 0", color: "var(--ink)" }}>
                  Tekrar ve İnceleme Öneriliyor
                </h2>
              </div>
              <span className="badge REVIEW">Tekrar Önerilir</span>
            </div>
            <p style={{ maxWidth: 640, margin: 0, color: "var(--text)", lineHeight: 1.65, fontSize: "0.98rem" }}>
              Bazı temel kavramları dersten önce tekrar gözden geçirmeniz tavsiye edilir. Aşağıdaki kavram notlarını inceleyip özet okumasına dönebilirsiniz.
            </p>
          </div>
        )}

        {attempt && (
          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Performans Dökümü</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Bu denemeye ait puan ve soru dağılımı</span>
              </div>
              <span className="badge" style={{ background: "var(--surface-subtle)" }}>
                {attempt.attemptNumber}. Deneme Sonucu
              </span>
            </div>

            <div className="editorial-metrics" style={{ borderTop: "none" }}>
              <div className="metric">
                <span className="metric-label">Ön Bilgi Skoru</span>
                <div className="metric-value" style={{ color: "var(--accent)" }}>
                  {attempt.finalScore === null ? "—" : `%${attempt.finalScore}`}
                </div>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {attempt.finalScore === null ? "Öğretmen incelemesi bekleniyor" : `Hedef Eşik: %${minimumScore}`}
                </span>
              </div>

              <div className="metric">
                <span className="metric-label">Hazır Bulunuşluk</span>
                <div className="metric-value" style={{ fontSize: "1.25rem" }}>
                  {STATUS_LABELS[sa.status as StudentStatus] ?? sa.status}
                </div>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Sistem Değerlendirmesi
                </span>
              </div>

              <div className="metric">
                <span className="metric-label">Deneme Durumu</span>
                <div className="metric-value" style={{ fontSize: "1.25rem" }}>
                  {policy.max !== null ? `${policy.used} / ${policy.max}` : "Sınırsız"}
                </div>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {policy.max !== null ? "Kullanılan Hak" : "Serbest Deneme"}
                </span>
              </div>

              <div className="metric">
                <span className="metric-label">Soru Dağılımı</span>
                {!attempt.pending ? (
                  <>
                    <div className="metric-value" style={{ fontSize: "1.2rem", color: "var(--leaf)" }}>
                      {attempt.correctCount} Doğru
                    </div>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>{attempt.incorrectCount} Yanlış / Eksik</span>
                  </>
                ) : (
                  <>
                    <div className="metric-value" style={{ fontSize: "1.1rem", color: "var(--accent)" }}>
                      {attempt.pendingCount} Bekleyen
                    </div>
                    <span className="muted" style={{ fontSize: "0.78rem" }}>Açık Uçlu Soru</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {recommendations && (recommendations.outcomes.length > 0 || recommendations.concepts.length > 0) && (
          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Gelişim ve İnceleme Önerileri</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Derse girmeden önce eksik kalan noktalara odaklanın</span>
              </div>
            </div>

            <div style={{ padding: "22px 24px" }}>
              {recommendations.concepts.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="editorial-kicker" style={{ color: "var(--accent)", marginBottom: 8 }}>ÖNCELİKLİ KAVRAMLAR</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {recommendations.concepts.map((k) => (
                      <div
                        key={k.term}
                        style={{
                          padding: "12px 16px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-subtle)",
                          border: "1px solid var(--border)",
                          borderLeft: "3px solid var(--accent)",
                        }}
                      >
                        <strong style={{ color: "var(--accent)", display: "block", marginBottom: 2 }}>{k.term}</strong>
                        <span style={{ fontSize: "0.92rem", color: "var(--text)", lineHeight: 1.6 }}>{k.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.outcomes.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="editorial-kicker" style={{ color: "var(--ink)", marginBottom: 8 }}>İLGİLİ MEB KAZANIMLARI</div>
                  <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                    {recommendations.outcomes.map((o) => (
                      <li key={o.code} style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>
                        <span className="code" style={{ marginRight: 6 }}>{o.code}</span>
                        <span>{o.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <Link className="button" href={`/ogrenci/gorevler/${id}/ozet`}>
                  Konu Özetini İncele →
                </Link>
              </div>
            </div>
          </div>
        )}

        {attempt && attempt.questions.some((q) => q.isCorrect !== null || q.explanation || q.correctAnswer || q.teacherFeedback) && (
          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Soru Analizi ve Geri Bildirim</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Verilen cevaplar ve öğretmen açıklamaları</span>
              </div>
            </div>

            <div style={{ padding: "20px 24px", display: "grid", gap: 16 }}>
              {attempt.questions.map((q, i) => (
                <div
                  key={i}
                  style={{
                    padding: 18,
                    borderRadius: "var(--radius-sm)",
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
                          background: q.isCorrect ? "var(--leaf-light)" : (q.awardedPoints ?? 0) > 0 ? "var(--amber-light)" : "var(--crimson-light)",
                          color: q.isCorrect ? "var(--leaf)" : (q.awardedPoints ?? 0) > 0 ? "var(--amber)" : "var(--crimson)",
                          borderColor: "transparent",
                        }}
                      >
                        {q.isCorrect ? "✓ Doğru" : (q.awardedPoints ?? 0) > 0 ? "◐ Kısmen Doğru" : "— Gözden Geçir"}
                        {q.awardedPoints !== null ? ` (${q.awardedPoints} / ${q.points} p)` : ""}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "6px 0 10px", fontWeight: 500, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.questionText}</p>
                  {q.correctAnswer && (
                    <div style={{ fontSize: "0.9rem", color: "var(--leaf)", background: "#ffffff", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-xs)", marginBottom: 8 }}>
                      <strong>Doğru Yanıt:</strong> {q.correctAnswer}
                    </div>
                  )}
                  {q.explanation && (
                    <p className="muted" style={{ margin: "6px 0", fontSize: "0.88rem", fontStyle: "italic", lineHeight: 1.6 }}>
                      {q.explanation}
                    </p>
                  )}
                  {q.teacherFeedback && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderLeft: "3px solid var(--accent)",
                        fontSize: "0.9rem",
                        borderRadius: "var(--radius-xs)",
                      }}
                    >
                      <strong style={{ color: "var(--accent)" }}>Öğretmen Değerlendirmesi:</strong> {q.teacherFeedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {sa.status === "NEEDS_REVIEW" && (
          <div className="editorial-panel" style={{ padding: "24px 28px", textAlign: "center" }}>
            {policy.limitReached ? (
              <p className="notice-inline error" style={{ margin: 0 }}>
                Bu görev için izin verilen maksimum deneme sayısını tamamladınız.
              </p>
            ) : (
              <div>
                <p className="muted" style={{ marginBottom: 16, fontSize: "0.95rem" }}>
                  Konu özetini inceleyip hazır hissettiğinizde tekrar deneyebilirsiniz.
                </p>
                <Link className="button primary" href={`/ogrenci/gorevler/${id}/calisma`} style={{ padding: "10px 22px" }}>
                  Ön Bilgi Kontrolünü Yeniden Dene →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
