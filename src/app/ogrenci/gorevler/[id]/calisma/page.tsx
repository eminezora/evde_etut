// "Ön Bilgi Kontrolü": start or continue the attempt. Access, status and limits are checked on
// the server; the page only reflects them.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getAssessmentView } from "@/lib/assessment/student-assessment-service.ts";
import { ProgressStepper } from "@/components/student/ProgressStepper.tsx";
import { AssessmentRunner, StartAttempt } from "@/components/student/AssessmentRunner.tsx";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;
  const view = await getAssessmentView(student.id, id);
  if (!view) notFound();
  const { sa, attempt, questions, policy } = view;
  if (sa.status === "NOT_STARTED" || sa.status === "READING") redirect(`/ogrenci/gorevler/${id}/ozet`);
  if (["READY_FOR_CLASS", "PENDING_TEACHER_REVIEW"].includes(sa.status)) redirect(`/ogrenci/gorevler/${id}/sonuc`);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href={`/ogrenci/gorevler/${id}`} style={{ textDecoration: "none" }}>
            ← Görev Detayına Dön
          </Link>
        </p>
        <div className="editorial-kicker">HAZIR BULUNUŞLUK ÇALIŞMASI</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>
          Ön Bilgi Kontrolü
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Öğrenme öncesi hazırlık sorularını dikkatle yanıtlayarak konuya hazır bulunuşluğunu ölç.
        </p>
      </div>

      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <div style={{ marginTop: 24 }}>
        {attempt ? (
          <AssessmentRunner assignmentId={id} attemptId={attempt.id} attemptNumber={attempt.attemptNumber} questions={questions} initialAnswers={attempt.answers} />
        ) : sa.status === "EXPIRED" ? (
          <div className="editorial-panel" style={{ borderLeft: "4px solid var(--crimson)", padding: 24 }}>
            <p className="notice-inline error" style={{ margin: 0 }}>
              Bu görevin son teslim tarihi geçmiştir; yeni bir deneme başlatılamaz.
            </p>
          </div>
        ) : (
          <div className="editorial-panel" style={{ maxWidth: 680 }}>
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.08rem", fontFamily: "var(--font-serif)" }}>Hazırlık Değerlendirmesi Masası</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Süre kısıtı yoktur · Sakin ve dikkatli yanıtlayın</span>
              </div>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <p style={{ lineHeight: 1.7, color: "var(--text)", fontSize: "0.98rem", margin: "0 0 20px" }}>
                Bu çalışma derste işlenecek konuyu daha rahat takip edebilmeniz için gereken temel ön bilgileri ve kavramları kontrol eder.
                Konuyu baştan sona eksiksiz bilmeniz beklenmez; amaç öğretmeninize dersteki hazır bulunuşluk düzeyinizi bildirmektir.
              </p>

              <div className="editorial-metrics" style={{ margin: "20px 0" }}>
                <div className="metric">
                  <span className="metric-label">Soru Adedi</span>
                  <div className="metric-value">{questions.length}</div>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>Çoktan seçmeli & açık uçlu</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Deneme Durumu</span>
                  <div className="metric-value" style={{ fontSize: "1.25rem", color: "var(--accent)" }}>
                    {policy.max === null ? "Sınırsız" : `${policy.remaining} / ${policy.max} Kalan`}
                  </div>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>
                    {policy.max === null ? "Öğrenene kadar tekrar" : "Kullanılabilir hak"}
                  </span>
                </div>
              </div>

              {policy.limitReached ? (
                <p className="notice-inline error" style={{ margin: "16px 0 0" }}>
                  Bu görev için tanımlanan maksimum deneme hakkınızı tamamladınız.
                </p>
              ) : (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <StartAttempt assignmentId={id} label={sa.status === "NEEDS_REVIEW" ? "Yeniden Dene" : "Ön Bilgi Kontrolünü Başlat"} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
