import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getTeacherContent } from "@/lib/content/content-service.ts";
import { fromQuestionRow } from "@/lib/content/question-schema.ts";
import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@/lib/ai/index.ts";
import { formatDate, statusLabel } from "@/lib/assignments/format.ts";
import { ContentEditor } from "@/components/ContentEditor.tsx";
import { getQuotaStatus } from "@/lib/usage/usage-quota-service.ts";
import { toMeterData } from "@/components/usage/UsageMeter.tsx";
import { prisma } from "@/lib/db.ts";
import { PolicyForm } from "@/components/teacher/PolicyForm.tsx";
import { AssignmentActions } from "@/components/teacher/AssignmentActions.tsx";
import { getEditState } from "@/lib/assignments/assignment-service.ts";

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const teacher = await requireTeacher();
  const aiQuota = toMeterData(await getQuotaStatus(prisma, { id: teacher.id, role: "TEACHER" }, "AI_CONTENT_GENERATION"));
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab = requested === "hazirlik" ? "hazirlik" : "genel";
  const a = await getTeacherContent(teacher.id, id);
  if (!a) notFound();
  const editState = await getEditState(a.id);
  const outcomes = a.assignmentOutcomes.map(({ outcome }) => ({ code: outcome.outcomeCode, text: outcome.outcomeText }));
  const c = a.studyContent;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href="/ogretmen/gorevler" style={{ textDecoration: "none" }}>← Görevler listesine dön</Link>
        </p>
        <div className="editorial-kicker">ÖĞRETMEN ÇALIŞMA MASASI · {a.grade}. SINIF {a.subject}</div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>{a.topic}</h1>
            <div className="row" style={{ gap: 8 }}>
              <span className={`badge ${a.status}`}>{statusLabel(a.status)}</span>
              <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--accent)" }}>{a.subject}</span>
              <span className="muted" style={{ fontSize: "0.88rem" }}>{a.classroom.name} ({a.grade}. sınıf)</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {a.status === "PUBLISHED" && (
              <Link href={`/ogretmen/gorevler/${a.id}/analiz`} className="button primary" style={{ minHeight: 38 }}>
                Analiz ve Hazırlık Raporu →
              </Link>
            )}
            <AssignmentActions assignmentId={a.id} archived={Boolean(a.archivedAt)} willArchive={a.status !== "DRAFT" || editState.studentsOpened > 0} />
          </div>
        </div>
      </div>

      {a.archivedAt && (
        <div className="editorial-panel" style={{ borderLeft: "4px solid var(--amber)", padding: 18, marginBottom: 20 }} role="note">
          <strong style={{ color: "var(--amber)" }}>Arşivlenmiş Görev:</strong> Bu görev arşivlendiği için listenizde ve öğrencilerin çalışma akışında gizlenmiştir. Geçmiş öğrenci cevapları ve rapor kayıtları güvenle korunur.
        </div>
      )}

      <nav className="tabs" aria-label="Görev sekmeleri" style={{ marginBottom: 24 }}>
        <Link href={`/ogretmen/gorevler/${a.id}`} aria-current={tab === "genel" ? "page" : undefined}>
          Genel Bilgiler & Parametreler
        </Link>
        <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} aria-current={tab === "hazirlik" ? "page" : undefined}>
          Hazırlık İçeriği & Soru Editörü
        </Link>
        {a.status === "PUBLISHED" && (
          <Link href={`/ogretmen/gorevler/${a.id}/analiz`}>
            Öğrenci Analizleri
          </Link>
        )}
      </nav>

      {tab === "genel" ? (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Görev Parametreleri</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Müfredat konumu, teslim tarihi ve başarı kriterleri</span>
              </div>
              <span className="badge" style={{ background: "var(--surface-subtle)" }}>
                Durum: {statusLabel(a.status)}
              </span>
            </div>

            <div style={{ padding: "20px" }}>
              <dl className="details" style={{ margin: 0 }}>
                <dt>Ders</dt><dd><strong>{a.subject}</strong></dd>
                <dt>Sınıf & Şube</dt><dd>{a.classroom.name} ({a.grade}. sınıf)</dd>
                <dt>Konu Başlığı</dt><dd>{a.topic}</dd>
                <dt>Tema / Ünite</dt><dd>{a.unitOrTheme}</dd>
                <dt>Başarı Eşiği</dt><dd>%{a.minimumScore} Hazır Bulunuşluk Puanı</dd>
                <dt>Son Teslim Tarihi</dt><dd><time>{formatDate(a.deadline)}</time></dd>
                <dt>Hazırlık Durumu</dt>
                <dd>
                  {c ? (c.status === "TEACHER_APPROVED" ? "Öğretmen Onaylı (Yayında)" : "Taslak – İnceleme Bekliyor") : "Oluşturulmadı"} · {a.questions.length} soru
                </dd>
              </dl>

              {a.status === "DRAFT" && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <Link href={`/ogretmen/gorevler/${a.id}?tab=hazirlik`} className="button primary">
                    Hazırlık İçeriğini İncele, Düzenle & Yayınla →
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>MEB Öğrenme Çıktıları</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Bu görevle hedeflenen resmi kazanımlar</span>
              </div>
              <span className="badge PUBLISHED">{a.assignmentOutcomes.length} Kazanım Eşleşti</span>
            </div>

            <div style={{ padding: "18px 20px" }}>
              {a.assignmentOutcomes.length === 0 ? (
                <p className="notice-inline warn" style={{ margin: 0 }}>Öğrenme çıktısı seçilmemiş. Bu görev yayınlanamaz.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {a.assignmentOutcomes.map(({ outcome }) => (
                    <div
                      key={outcome.id}
                      style={{
                        padding: "12px 16px",
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--border)",
                        borderLeft: "3px solid var(--accent)",
                        borderRadius: "var(--radius-xs)",
                      }}
                    >
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <span className="code">{outcome.outcomeCode}</span>
                        <span className="badge PUBLISHED" style={{ fontSize: "0.72rem" }}>MEB Resmi Kazanım</span>
                      </div>
                      <div style={{ fontSize: "0.93rem", lineHeight: 1.6, color: "var(--ink)" }}>{outcome.outcomeText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="editorial-panel">
            <div className="editorial-panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Teslim ve Değerlendirme Politikası</h2>
                <span className="muted" style={{ fontSize: "0.82rem" }}>Deneme limitleri ve açıklama görünürlüğü ayarları</span>
              </div>
            </div>
            <div style={{ padding: "20px" }}>
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
          </div>
        </div>
      ) : (
        <ContentEditor
          aiQuota={aiQuota}
          key={`${c?.updatedAt?.getTime() ?? 0}-${a.updatedAt?.getTime() ?? 0}-${a.questions.length}-${a.questions[0]?.id ?? ""}`}
          assignmentId={a.id}
          assignmentStatus={a.status}
          aiConfigured={isAiConfigured()}
          aiNotConfiguredMessage={AI_NOT_CONFIGURED_MESSAGE}
          questionCount={a.questionCount}
          questionsLocked={editState.started || Boolean(a.archivedAt)}
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
