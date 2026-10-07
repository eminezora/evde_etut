import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getAssignmentForTeacher, getEditState, MIN_SCORE_LOCKED_MESSAGE, QUESTION_COUNT_LOCKED_MESSAGE } from "@/lib/assignments/assignment-service.ts";
import { AssignmentEditForm } from "@/components/teacher/AssignmentEditForm.tsx";
import { PolicyForm } from "@/components/teacher/PolicyForm.tsx";

export const metadata = { title: "Görevi Düzenle – Evde Etüt" };

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const a = await getAssignmentForTeacher(teacher.id, id);
  if (!a) notFound();
  const state = await getEditState(a.id);

  return (
    <>
      <p className="muted" style={{ marginBottom: 8 }}>
        <Link href={`/ogretmen/gorevler/${a.id}`}>← Görev detayına dön</Link>
      </p>
      <h1 style={{ margin: "4px 0 16px" }}>Görevi Düzenle</h1>

      {a.archivedAt ? (
        <div className="card archived-banner">Bu görev arşivde. Düzenlemek için önce görev detayından arşivden çıkarın.</div>
      ) : (
        <>
          <div className={`card ${state.started ? "archived-banner" : ""}`} role="note">
            {state.started ? (
              <p style={{ margin: 0 }}>
                <strong>Öğrenciler bu görevi çözmeye başladı ({state.attempts} deneme).</strong> Mevcut cevapların ve sonuçların bozulmaması için sorular ve başarı eşiği kilitlendi. Başlığı, son teslim tarihini, deneme hakkını ve hazırlık içeriğinin metnini değiştirebilirsiniz; içerik değişiklikleri yeni sürüm olarak kaydedilir.
              </p>
            ) : (
              <p style={{ margin: 0 }}>Henüz hiçbir öğrenci bu görevin sorularını çözmeye başlamadı; tüm alanları, hazırlık içeriğini ve soruları değiştirebilirsiniz.</p>
            )}
          </div>

          <div className="card">
            <AssignmentEditForm
              assignmentId={a.id}
              initial={{ topic: a.topic, deadline: a.deadline.toISOString(), minimumScore: a.minimumScore, questionCount: a.questionCount }}
              started={state.started}
              isDraft={a.status === "DRAFT"}
              minScoreLockedMessage={MIN_SCORE_LOCKED_MESSAGE}
              questionCountLockedMessage={QUESTION_COUNT_LOCKED_MESSAGE}
            />
          </div>

          <div className="card">
            <PolicyForm
              assignmentId={a.id}
              initial={{ maxAttempts: a.maxAttempts, unlimitedAttempts: a.unlimitedAttempts, showExplanationsAfterSubmit: a.showExplanationsAfterSubmit, showAnswersAfterPass: a.showAnswersAfterPass }}
            />
          </div>

          <div className="card row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Hazırlık içeriği ve sorular ayrı sekmede düzenlenir.</span>
            <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} className="button">Hazırlık İçeriği & Sorular →</Link>
          </div>
        </>
      )}
    </>
  );
}
