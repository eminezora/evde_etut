// Assignment analytics + "Yarınki Derse Hazırlık Raporu". Owner teacher only (the report query
// itself filters by teacherId; students are redirected by requireTeacher).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { REPORT_STATUS_LABELS, getAssignmentReport } from "@/lib/analytics/assignment-report.ts";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/content/question-schema.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { BarList } from "@/components/analytics/BarList.tsx";
import { TrendChart } from "@/components/analytics/TrendChart.tsx";
import { PrintButton } from "@/components/analytics/PrintButton.tsx";
import { StudentTable } from "@/components/analytics/StudentTable.tsx";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";

const EMPTY = "Bu görev için henüz yeterli öğrenci verisi oluşmadı.";
const rate = (v: number | null) => (v === null ? "—" : `%${v}`);
const num = (v: number | null) => (v === null ? "—" : String(v).replace(".", ","));

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const r = await getAssignmentReport(teacher.id, id);
  if (!r) notFound();
  const { assignment: a, totals: t } = r;
  const fmt = (d: Date | null) => (d ? formatDate(d) : null);

  const struggleText = r.hasData ? "Belirgin bir zorlanma görülmedi" : "—";
  const briefRows: [string, React.ReactNode][] = [
    ["Toplam öğrenci", t.assigned],
    ["Göreve başlayan", t.started],
    ["Tamamlayan", t.completed],
    ["Derse Hazır", t.ready],
    ["Tekrar Gerekli", t.needsReview],
    ["Öğretmen Değerlendirmesi Bekleniyor", t.pending],
    ["Tamamlamadı", t.notCompleted],
    ["Sınıf hazırlık oranı", rate(t.readinessRate)],
    ["Ortalama puan", t.averageLatestScore === null ? "—" : `%${num(t.averageLatestScore)}`],
    ["Ortalama deneme", num(t.averageAttempts)],
    [
      "En çok zorlanılan öğrenme çıktısı",
      r.briefing.hardestOutcome ? (
        <><span className="code" style={{ display: "inline" }}>{r.briefing.hardestOutcome.code}</span> ({rate(r.briefing.hardestOutcome.successRate)})</>
      ) : struggleText,
    ],
    ["En çok zorlanılan soru", r.briefing.hardestQuestion ? `Soru ${r.briefing.hardestQuestion.number} (doğru oranı ${rate(r.briefing.hardestQuestion.correctRate)})` : struggleText],
  ];
  const maxStatus = Math.max(1, ...r.statusDistribution.map((s) => s.count));
  const maxScore = Math.max(1, ...r.scoreDistribution.map((s) => s.count));

  return (
    <div className="report">
      <p className="no-print"><Link href={`/ogretmen/gorevler/${a.id}`}>← Göreve dön</Link></p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 4 }}>Analiz: {a.topic}</h1>
        <div className="row no-print">
          <a className="button" href={`/api/assignments/${a.id}/report`} download>CSV İndir</a>
          <PrintButton />
        </div>
      </div>
      <p className="muted">{a.classroom} · {a.subject} · {a.unitOrTheme} · Son tarih {formatDate(a.deadline)} · Eşik %{a.minimumScore}</p>

      {/* Briefing */}
      <section className="editorial-panel" aria-labelledby="briefing-title">
        <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>PEDAGOJİK ANALİZ</span>
        <h2 id="briefing-title" style={{ fontSize: "1.3rem", margin: "2px 0 6px" }}>Yarınki Derse Hazırlık Raporu</h2>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: "0.88rem" }}>
          <strong>{a.classroom} – {a.subject}</strong> · Konu: {a.topic}
        </p>

        <dl className="brief-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, margin: "16px 0", padding: "14px", backgroundColor: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
          {briefRows.map(([label, value]) => (
            <div key={label}>
              <dt style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>{label}</dt>
              <dd style={{ fontSize: "1.05rem", fontWeight: 600, margin: "2px 0 0", color: "var(--text)" }}>{value}</dd>
            </div>
          ))}
        </dl>

        {r.recommendation ? (
          <div style={{ padding: "12px 16px", backgroundColor: "var(--accent-light)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-xs)", fontSize: "0.92rem", color: "var(--text)" }} role="note">
            <strong style={{ color: "var(--accent)" }}>Ders Başlangıç Önerisi: </strong>
            {r.recommendation.text}
            {r.recommendation.focus && <> {r.recommendation.focus}</>}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{EMPTY}</p>
        )}
      </section>

      {/* Metrics Strip */}
      <section className="editorial-panel" aria-labelledby="kpi-title">
        <h2 id="kpi-title" style={{ fontSize: "1.15rem", marginBottom: 16 }}>Sınıf Düzeyi Özet Göstergeleri</h2>
        <div className="editorial-metrics">
          <div className="metric-item">
            <div className="metric-value">{rate(t.readinessRate)}</div>
            <div className="metric-label">Genel Hazırlık Oranı</div>
            <div className="metric-desc">Hazır / Toplam ({t.ready}/{t.assigned})</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{rate(t.readinessAmongCompleted)}</div>
            <div className="metric-label">Tamamlayanlar İçi Oran</div>
            <div className="metric-desc">Hazır / Biten ({t.ready}/{t.completed})</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{t.averageLatestScore === null ? "—" : `%${num(t.averageLatestScore)}`}</div>
            <div className="metric-label">Ortalama Puan</div>
            <div className="metric-desc">En iyi ort. {t.averageBestScore === null ? "—" : `%${num(t.averageBestScore)}`}</div>
          </div>
          <div className="metric-item">
            <div className="metric-value">{num(t.averageAttempts)}</div>
            <div className="metric-label">Ortalama Deneme</div>
            <div className="metric-desc">Deneme yapan öğrenciler</div>
          </div>
        </div>
      </section>

      <div className="report-grid">
        <section className="editorial-panel" aria-labelledby="status-title">
          <h2 id="status-title">Durum dağılımı</h2>
          <BarList
            caption="Öğrencilerin duruma göre dağılımı"
            items={r.statusDistribution.map((s) => ({ key: s.status, label: s.label, value: s.count, max: maxStatus, display: `${s.count} öğrenci` }))}
          />
        </section>
        <section className="editorial-panel" aria-labelledby="score-title">
          <h2 id="score-title">Puan dağılımı</h2>
          {r.hasData ? (
            <BarList
              caption="Son nihai puanların aralıklara göre dağılımı"
              items={r.scoreDistribution.map((b) => ({ key: b.label, label: `%${b.label}`, value: b.count, max: maxScore, display: `${b.count} öğrenci` }))}
            />
          ) : (
            <p className="muted">{EMPTY}</p>
          )}
        </section>
      </div>

      <section className="editorial-panel" aria-labelledby="outcome-title">
        <h2 id="outcome-title">Öğrenme çıktısı başarısı</h2>
        {r.hasData && r.outcomeStats.some((o) => o.successRate !== null) ? (
          <>
            {r.weakestOutcomes.length > 0 && (
              <div className="info" style={{ marginBottom: 12 }}>
                <strong>Ders Başında Tekrar Edilmesi Önerilen Alanlar</strong>
                <ul style={{ margin: "6px 0 0" }}>
                  {r.weakestOutcomes.map((o) => <li key={o.code}><span className="code" style={{ display: "inline" }}>{o.code}</span> {o.text} — başarı {rate(o.successRate)}</li>)}
                </ul>
              </div>
            )}
            <BarList
              caption="Öğrenme çıktısı bazında başarı oranı"
              items={r.outcomeStats.map((o) => ({
                key: o.code,
                label: <span className="code" style={{ display: "inline" }}>{o.code}</span>,
                value: o.successRate,
                max: 100,
                display: `${rate(o.successRate)} · ${o.questionCount} soru`,
                hint: o.text,
              }))}
            />
            <div className="table-scroll">
              <table>
                <thead><tr><th>Çıktı</th><th>Bağlı soru</th><th>Başarı</th><th>Tam doğru oranı</th></tr></thead>
                <tbody>
                  {r.outcomeStats.map((o) => <tr key={o.code}><td><span className="code" style={{ display: "inline" }}>{o.code}</span> {o.text}</td><td>{o.questionCount}</td><td>{rate(o.successRate)}</td><td>{rate(o.correctRate)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <p className="muted">Başarı: bağlı sorulardan alınan puan / alınabilecek puan (her öğrencinin son değerlendirilen denemesi).</p>
          </>
        ) : (
          <p className="muted">{EMPTY}</p>
        )}
      </section>

      <section className="editorial-panel" aria-labelledby="question-title">
        <h2 id="question-title">Soru analizi</h2>
        {r.hasData && r.questionStats.some((q) => q.correctRate !== null) ? (
          <>
            <div className="info" style={{ marginBottom: 12 }}>
              <strong>En Çok Zorlanılan Sorular</strong>
              {r.hardestQuestions.length === 0 ? (
                <p style={{ margin: "6px 0 0" }}>{"Doğru oranı %80'in altında kalan soru yok."}</p>
              ) : (
                <ul style={{ margin: "6px 0 0" }}>
                  {r.hardestQuestions.map((q) => <li key={q.questionId}>Soru {q.number} — doğru oranı {rate(q.correctRate)}: {q.text.length > 90 ? `${q.text.slice(0, 90)}…` : q.text}</li>)}
                </ul>
              )}
            </div>
            <BarList
              caption="Soru bazında doğru oranı"
              items={r.questionStats.map((q) => ({ key: q.questionId, label: `Soru ${q.number}`, value: q.correctRate, max: 100, display: rate(q.correctRate), hint: q.text }))}
            />
            <div className="table-scroll">
              <table>
                <thead><tr><th>#</th><th>Soru</th><th>Tür</th><th>Değerlendirilen</th><th>Doğru</th><th>Yanlış/eksik</th><th>Doğru oranı</th><th>Ort. puan</th><th>Çıktı</th></tr></thead>
                <tbody>
                  {r.questionStats.map((q) => (
                    <tr key={q.questionId}>
                      <td>{q.number}</td>
                      <td>{q.text}</td>
                      <td>{QUESTION_TYPE_LABELS[q.type as QuestionType] ?? q.type}</td>
                      <td>{q.answered}</td>
                      <td>{q.correct}</td>
                      <td>{q.incorrect}</td>
                      <td>{rate(q.correctRate)}</td>
                      <td>{q.averagePoints === null ? "—" : `${num(q.averagePoints)} / ${q.points}`}</td>
                      <td>{q.outcomeCodes.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="muted">{EMPTY}</p>
        )}
      </section>

      {r.trend.length > 1 && (
        <section className="editorial-panel" aria-labelledby="trend-title">
          <h2 id="trend-title">Hazırlık oranı eğilimi · {a.classroom} {a.subject}</h2>
          <TrendChart points={r.trend} />
          <p className="muted">Her görev için: derse hazır öğrenci / sınıfın şu anki öğrenci sayısı. Son tarihi geçmemiş görevler henüz değişebilir.</p>
        </section>
      )}

      <section className="editorial-panel" aria-labelledby="students-title">
        <h2 id="students-title">Öğrenciler</h2>
        {r.students.length === 0 ? (
          <p className="muted">Bu sınıfta öğrenci yok.</p>
        ) : (
          <StudentTable
            assignmentId={a.id}
            rows={r.students.map((s) => ({
              studentId: s.studentId,
              name: s.name,
              status: s.status,
              statusLabel: REPORT_STATUS_LABELS[s.status],
              summaryOpened: fmt(s.summaryOpenedAt),
              summaryConfirmed: fmt(s.summaryConfirmedAt),
              startedAt: fmt(s.startedAt),
              detailedStatus: STATUS_LABELS[s.detailedStatus as StudentStatus] ?? s.detailedStatus,
              latestPoints: s.latestPoints ? `${s.latestPoints.earned}/${s.latestPoints.total}` : null,
              attemptCount: s.attemptCount,
              latestScore: s.latestScore,
              bestScore: s.bestScore,
              completedAt: fmt(s.completedAt),
            }))}
          />
        )}
      </section>
    </div>
  );
}
