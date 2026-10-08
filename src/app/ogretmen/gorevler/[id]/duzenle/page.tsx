import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getAssignmentForTeacher, getEditState, MIN_SCORE_LOCKED_MESSAGE, QUESTION_COUNT_LOCKED_MESSAGE } from "@/lib/assignments/assignment-service.ts";
import { AssignmentEditForm } from "@/components/teacher/AssignmentEditForm.tsx";
import { PolicyForm } from "@/components/teacher/PolicyForm.tsx";

export const metadata = { title: "Görevi Düzenle – DersBot" };

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const a = await getAssignmentForTeacher(teacher.id, id);
  if (!a) notFound();
  const state = await getEditState(a.id);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href={`/ogretmen/gorevler/${a.id}`} style={{ textDecoration: "none" }}>← Görev detayına dön</Link>
        </p>
        <div className="editorial-kicker">PARAMETRE GÜNCELLEME MASASI</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>Görevi Düzenle</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          {a.topic} · {a.classroom.name} ({a.grade}. Sınıf)
        </p>
      </div>

      {a.archivedAt ? (
        <div className="editorial-panel" style={{ borderLeft: "4px solid var(--amber)", padding: 20 }}>
          Bu görev arşivlenmiştir. Düzenleme yapabilmek için lütfen önce görev detay sayfasından görevi arşivden çıkarın.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          <div
            className="editorial-panel"
            style={{
              padding: "16px 20px",
              borderLeft: state.started ? "4px solid var(--amber)" : "4px solid var(--accent)",
              background: "var(--surface-subtle)",
            }}
            role="note"
          >
            {state.started ? (
              <p style={{ margin: 0, fontSize: "0.93rem", lineHeight: 1.6 }}>
                <strong>Öğrenciler bu görevi çözmeye başladı ({state.attempts} deneme).</strong> Mevcut cevapların ve sonuçların tutarlılığı için sorular ve hazır bulunuşluk puan eşiği kilitlenmiştir. Başlığı, son teslim tarihini, deneme hakkını ve hazırlık metnini güncelleyebilirsiniz.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "0.93rem", lineHeight: 1.6 }}>
                Henüz hiçbir öğrenci bu görevi çözmeye başlamadı. Tüm alanları, teslim tarihlerini ve soruları serbestçe güncelleyebilirsiniz.
              </p>
            )}
          </div>

          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Temel Görev Bilgileri</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Başlık, teslim tarihi ve soru adedi</span>
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              <AssignmentEditForm
                assignmentId={a.id}
                initial={{ topic: a.topic, deadline: a.deadline.toISOString(), minimumScore: a.minimumScore, questionCount: a.questionCount }}
                started={state.started}
                isDraft={a.status === "DRAFT"}
                minScoreLockedMessage={MIN_SCORE_LOCKED_MESSAGE}
                questionCountLockedMessage={QUESTION_COUNT_LOCKED_MESSAGE}
              />
            </div>
          </div>

          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Teslim Politikası ve İzinler</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Deneme sayısı ve çözüm açıklamaları kuralları</span>
              </div>
            </div>
            <div style={{ padding: "20px" }}>
              <PolicyForm
                assignmentId={a.id}
                initial={{ maxAttempts: a.maxAttempts, unlimitedAttempts: a.unlimitedAttempts, showExplanationsAfterSubmit: a.showExplanationsAfterSubmit, showAnswersAfterPass: a.showAnswersAfterPass }}
              />
            </div>
          </div>

          <div className="editorial-panel" style={{ padding: "18px 22px" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong style={{ fontSize: "0.95rem" }}>Hazırlık Metni ve Soru Editörü</strong>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                  Konu özeti, kavramlar ve soru listesi özel editoryal çalışma masasında düzenlenir.
                </p>
              </div>
              <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} className="button primary">
                Hazırlık İçeriği & Sorular →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
