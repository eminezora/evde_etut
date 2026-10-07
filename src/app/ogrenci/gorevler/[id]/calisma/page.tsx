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
      <div style={{ marginBottom: 16 }}>
        <Link href={`/ogrenci/gorevler/${id}`} style={{ textDecoration: "none", color: "var(--muted)", fontWeight: 500, fontSize: "0.92rem" }}>
          ← Görev Detayına Dön
        </Link>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 6 }}>Ön Bilgi Kontrolü</h1>
        <p className="muted" style={{ margin: 0 }}>
          Öğrenme öncesi hazırlık sorularını dikkatlice yanıtlayarak hazır bulunuşluğunu ölç.
        </p>
      </div>

      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      {attempt ? (
        <AssessmentRunner assignmentId={id} attemptId={attempt.id} attemptNumber={attempt.attemptNumber} questions={questions} initialAnswers={attempt.answers} />
      ) : sa.status === "EXPIRED" ? (
        <div className="card" style={{ borderColor: "var(--danger-border)", background: "var(--danger-bg)" }}>
          <p style={{ color: "var(--danger-text)", margin: 0, fontWeight: 600 }}>
            ⚠️ Bu görevin son teslim tarihi geçti; yeni bir deneme başlatılamaz.
          </p>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>🎯</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Hazırlık Değerlendirmesi</h2>
              <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>Süre sınırı yoktur, sakin ve dikkatli cevapla</p>
            </div>
          </div>

          <p style={{ lineHeight: 1.6, color: "var(--text)" }}>
            Bu çalışma derste işlenecek konuyu daha rahat takip edebilmen için gereken temel ön bilgileri kontrol eder.
            Konuyu baştan sona eksiksiz bilmen beklenmez.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "18px 0" }}>
            <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>Soru Sayısı</span>
              <strong style={{ fontSize: "1.1rem" }}>{questions.length} Soru</strong>
            </div>
            <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: "0.8rem", display: "block" }}>Deneme Hakkı</span>
              <strong style={{ fontSize: "1.1rem" }}>{policy.max === null ? "Sınırsız" : `${policy.remaining} / ${policy.max} Kalan`}</strong>
            </div>
          </div>

          {policy.limitReached ? (
            <p className="error" style={{ margin: "16px 0 0" }}>Bu görev için izin verilen maksimum deneme sayısını tamamladın.</p>
          ) : (
            <div style={{ marginTop: 20 }}>
              <StartAttempt assignmentId={id} label={sa.status === "NEEDS_REVIEW" ? "Yeniden Dene" : "Ön Bilgi Kontrolünü Başlat"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
