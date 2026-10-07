import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getTeacherContent } from "@/lib/content/content-service.ts";
import { fromQuestionRow } from "@/lib/content/question-schema.ts";
import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@/lib/ai/index.ts";
import { formatDate, statusLabel } from "@/lib/assignments/format.ts";
import { ContentEditor } from "@/components/ContentEditor.tsx";
import { PolicyForm } from "@/components/teacher/PolicyForm.tsx";

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab = requested === "hazirlik" ? "hazirlik" : "genel";
  const a = await getTeacherContent(teacher.id, id);
  if (!a) notFound();
  const outcomes = a.assignmentOutcomes.map(({ outcome }) => ({ code: outcome.outcomeCode, text: outcome.outcomeText }));
  const c = a.studyContent;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginBottom: 8 }}>
          <Link href="/ogretmen/gorevler">← Görevler listesine dön</Link>
        </p>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className={`badge ${a.status}`}>{statusLabel(a.status)}</span>
              <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{a.subject}</span>
              <span className="muted" style={{ fontSize: "0.88rem" }}>{a.classroom.name} ({a.grade}. sınıf)</span>
            </div>
            <h1 style={{ margin: "4px 0 0" }}>{a.topic}</h1>
          </div>
          {a.status === "PUBLISHED" && (
            <Link href={`/ogretmen/gorevler/${a.id}/analiz`} className="button primary" style={{ minHeight: 38 }}>
              📊 Hazırlık Analizini Gör
            </Link>
          )}
        </div>
      </div>

      <nav className="tabs" aria-label="Görev sekmeleri">
        <Link href={`/ogretmen/gorevler/${a.id}`} aria-current={tab === "genel" ? "page" : undefined}>
          Genel Bilgiler
        </Link>
        <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} aria-current={tab === "hazirlik" ? "page" : undefined}>
          Hazırlık İçeriği & Sorular
        </Link>
        {a.status === "PUBLISHED" && (
          <Link href={`/ogretmen/gorevler/${a.id}/analiz`}>
            Analiz ve Hazırlık Raporu
          </Link>
        )}
      </nav>

      {tab === "genel" ? (
        <>
          <div className="card">
            <h2>Görev Parametreleri</h2>
            <dl className="details" style={{ marginTop: 12 }}>
              <dt>Ders</dt><dd>{a.subject}</dd>
              <dt>Sınıf</dt><dd>{a.classroom.name} ({a.grade}. sınıf)</dd>
              <dt>Konu</dt><dd>{a.topic}</dd>
              <dt>Tema / Ünite</dt><dd>{a.unitOrTheme}</dd>
              <dt>Başarı Eşiği</dt><dd>%{a.minimumScore} (Derse Hazır Rozeti için)</dd>
              <dt>Son Tarih</dt><dd>{formatDate(a.deadline)}</dd>
              <dt>Durum</dt><dd><span className={`badge ${a.status}`}>{statusLabel(a.status)}</span></dd>
              <dt>Hazırlık İçeriği</dt>
              <dd>
                {c ? (c.status === "TEACHER_APPROVED" ? "Onaylandı (Öğrencilere Açık)" : "Taslak – onay bekliyor") : "Henüz oluşturulmadı"} · {a.questions.length} soru
              </dd>
            </dl>

            {a.status === "DRAFT" && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} className="button primary">
                  Hazırlık İçeriğini Düzenle & Yayınla →
                </Link>
              </div>
            )}
          </div>

          <div className="card">
            <h2>MEB Öğrenme Çıktıları</h2>
            {a.assignmentOutcomes.length === 0 ? (
              <p className="muted">Öğrenme çıktısı seçilmemiş. Bu görev yayınlanamaz.</p>
            ) : (
              <ul className="option-list" style={{ listStyle: "none", padding: 0 }}>
                {a.assignmentOutcomes.map(({ outcome }) => (
                  <li key={outcome.id} className="option" style={{ cursor: "default" }}>
                    <div style={{ width: "100%" }}>
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <span className="code">{outcome.outcomeCode}</span>
                        <span className="badge PUBLISHED" style={{ fontSize: "0.75rem" }}>Doğrulanmış MEB Kazanımı</span>
                      </div>
                      <div style={{ fontSize: "0.95rem" }}>{outcome.outcomeText}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <PolicyForm
              assignmentId={a.id}
              initial={{
                maxAttempts: a.maxAttempts,
                unlimitedAttempts: a.unlimitedAttempts,
                showExplanationsAfterSubmit: a.showExplanationsAfterSubmit,
                showAnswersAfterPass: a.showAnswersAfterPass,
              }}
            />
          </div>
        </>
      ) : (
        <ContentEditor
          key={c?.updatedAt.getTime() ?? 0}
          assignmentId={a.id}
          assignmentStatus={a.status}
          aiConfigured={isAiConfigured()}
          aiNotConfiguredMessage={AI_NOT_CONFIGURED_MESSAGE}
          questionCount={a.questionCount}
          outcomes={outcomes}
          content={
            c && {
              introduction: c.introduction,
              keyConcepts: c.keyConcepts as { term: string; explanation: string }[],
              summary: c.summary,
              simpleExample: c.simpleExample,
              mustKnow: c.mustKnow as string[],
              status: c.status,
              generatedBy: c.generatedBy,
              contentVersion: c.contentVersion,
            }
          }
          questions={a.questions.map((q) => {
            const codes = q.outcomes.map((o) => o.outcome.outcomeCode);
            return { id: q.id, type: q.type, questionText: q.questionText, points: q.points, generatedBy: q.generatedBy, outcomeCodes: codes, strict: fromQuestionRow(q, codes) };
          })}
        />
      )}
    </>
  );
}
