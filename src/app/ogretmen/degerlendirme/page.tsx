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
      <h1>Değerlendirme Bekleyenler</h1>
      <p className="muted">Açık uçlu cevapları puanladığınızda, öğrencinin nihai puanı hesaplanır ve derse hazır olma eşiğiyle karşılaştırılır.</p>
      {items.length === 0 && <div className="card"><p className="muted">Değerlendirme bekleyen cevap yok.</p></div>}
      {items.map((x) => (
        <div key={x.answerId} className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            <strong>{x.student}</strong> · <Link href={`/ogretmen/gorevler/${x.assignment.id}/ogrenci/${x.studentId}`}>{x.assignment.topic}</Link> ({x.assignment.subject}) · {x.attemptNumber}. deneme
            {x.submittedAt ? ` · ${formatDate(x.submittedAt)}` : ""}
          </p>
          <p className="muted" style={{ margin: 0 }}>{QUESTION_TYPE_LABELS[x.question.type as QuestionType]} · en fazla {x.maxPoints} puan</p>
          {x.question.context && <blockquote className="context">{x.question.context}</blockquote>}
          <p style={{ whiteSpace: "pre-wrap", fontWeight: 600 }}>{x.question.text}</p>
          <div className="info"><strong>Öğrenci cevabı:</strong><p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{x.answerText || "—"}</p></div>
          {x.question.sampleAnswer && <p className="muted">Örnek cevap: {x.question.sampleAnswer}</p>}
          {x.question.rubric && <p className="muted">Ölçüt: {x.question.rubric}</p>}
          <ReviewForm answerId={x.answerId} maxPoints={x.maxPoints} />
        </div>
      ))}
    </>
  );
}
