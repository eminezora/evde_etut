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
    <>
      <p><Link href={`/ogrenci/gorevler/${id}`}>← Göreve dön</Link></p>
      <h1>Sonuç</h1>
      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />
      {!attempt ? (
        <div className="card"><p className="muted">Henüz gönderilmiş bir çalışma yok.</p></div>
      ) : attempt.pending ? (
        <div className="card result pending" role="status">
          <h2>⏳ Öğretmen Değerlendirmesi Bekleniyor</h2>
          <p>{MESSAGES.pendingMessage}</p>
        </div>
      ) : sa.status === "READY_FOR_CLASS" ? (
        <div className="card result ready" role="status">
          <p className="result-title">✓ DERSE HAZIRSIN!</p>
          <p>Bu konu için gerekli temel ön bilgiyi oluşturdun. Artık derste yeni konuyu öğrenmeye hazırsın.</p>
        </div>
      ) : (
        <div className="card result review" role="status">
          <p className="result-title">↻ Biraz daha hazırlığa ihtiyacın var.</p>
          <p>Bazı temel kavramları tekrar gözden geçirip yeniden deneyebilirsin.</p>
        </div>
      )}

      {attempt && (
        <div className="card">
          <dl className="details">
            <dt>Puanın</dt><dd>{attempt.finalScore === null ? "Öğretmen değerlendirmesinden sonra belli olacak" : `%${attempt.finalScore}`}</dd>
            <dt>Derse hazır olma eşiği</dt><dd>%{minimumScore}</dd>
            <dt>Durum</dt><dd>{STATUS_LABELS[sa.status as StudentStatus] ?? sa.status}</dd>
            <dt>Deneme</dt><dd>{attempt.attemptNumber}. deneme · toplam {policy.used}{policy.max !== null ? ` / ${policy.max}` : ""}</dd>
            {!attempt.pending && (<><dt>Doğru / yanlış</dt><dd>{attempt.correctCount} doğru · {attempt.incorrectCount} yanlış veya eksik</dd></>)}
            {attempt.pending && (<><dt>Değerlendirme bekleyen</dt><dd>{attempt.pendingCount} açık uçlu cevap</dd></>)}
          </dl>
        </div>
      )}

      {recommendations && (recommendations.outcomes.length > 0 || recommendations.concepts.length > 0) && (
        <div className="card">
          <h2>Tekrar Bakmanı Öneriyoruz</h2>
          {recommendations.concepts.length > 0 && (
            <>
              <h3>Temel kavramlar</h3>
              <ul>{recommendations.concepts.map((k) => <li key={k.term}><strong>{k.term}:</strong> {k.explanation}</li>)}</ul>
            </>
          )}
          {recommendations.outcomes.length > 0 && (
            <>
              <h3>İlgili öğrenme çıktıları</h3>
              <ul>{recommendations.outcomes.map((o) => <li key={o.code}><span className="code" style={{ display: "inline" }}>{o.code}</span> {o.text}</li>)}</ul>
            </>
          )}
          <p><Link href={`/ogrenci/gorevler/${id}/ozet`}>Konu özetine geri dön →</Link></p>
        </div>
      )}

      {attempt && attempt.questions.some((q) => q.isCorrect !== null || q.explanation || q.correctAnswer || q.teacherFeedback) && (
        <div className="card">
          <h2>Soru bazında geri bildirim</h2>
          <ol>
            {attempt.questions.map((q, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                <span className="muted">{QUESTION_TYPE_LABELS[q.type as QuestionType]}</span>
                <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{q.questionText}</p>
                {q.isCorrect !== null && <p style={{ margin: 0 }}>{q.isCorrect ? "✓ Doğru" : (q.awardedPoints ?? 0) > 0 ? "◐ Kısmen doğru" : "✗ Yanlış veya boş"}{q.awardedPoints !== null ? ` (${q.awardedPoints} / ${q.points} puan)` : ""}</p>}
                {q.correctAnswer && <p style={{ margin: 0 }}>Doğru cevap: {q.correctAnswer}</p>}
                {q.explanation && <p className="muted" style={{ margin: 0 }}>{q.explanation}</p>}
                {q.teacherFeedback && <p className="info">Öğretmeninin notu: {q.teacherFeedback}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {sa.status === "NEEDS_REVIEW" && (
        <div className="card">
          {policy.limitReached ? (
            <p className="error">Bu görev için izin verilen deneme sayısını tamamladın.</p>
          ) : (
            <Link className="button primary" href={`/ogrenci/gorevler/${id}/calisma`}>Tekrar Çalış ve Yeniden Dene</Link>
          )}
        </div>
      )}
    </>
  );
}
