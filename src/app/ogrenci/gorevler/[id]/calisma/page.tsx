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
    <>
      <p><Link href={`/ogrenci/gorevler/${id}`}>← Göreve dön</Link></p>
      <h1>Ön Bilgi Kontrolü</h1>
      <ProgressStepper status={sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />
      {attempt ? (
        <AssessmentRunner assignmentId={id} attemptId={attempt.id} attemptNumber={attempt.attemptNumber} questions={questions} initialAnswers={attempt.answers} />
      ) : sa.status === "EXPIRED" ? (
        <div className="card"><p className="error">Bu görevin son tarihi geçti; yeni deneme başlatılamaz.</p></div>
      ) : (
        <div className="card">
          <p>Bu kısa çalışma, derste anlatılacak konuyu takip edebilmen için gereken temel ön bilgiyi kontrol eder. Konuyu tamamen bilmen beklenmiyor.</p>
          <p className="muted">{questions.length} soru · {policy.max === null ? "Sınırsız deneme" : `Kalan deneme: ${policy.remaining} / ${policy.max}`}</p>
          {policy.limitReached ? (
            <p className="error">Bu görev için izin verilen deneme sayısını tamamladın.</p>
          ) : (
            <StartAttempt assignmentId={id} label={sa.status === "NEEDS_REVIEW" ? "Yeniden Dene" : "Ön Bilgi Kontrolünü Başlat"} />
          )}
        </div>
      )}
    </>
  );
}
