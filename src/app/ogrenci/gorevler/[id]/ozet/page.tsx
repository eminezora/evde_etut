// Summary page. Opening it is recorded by a POST from SummaryOpened (not during render, so link
// prefetching cannot mark it); confirmation is a separate server action.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentOverview } from "@/lib/assessment/student-assessment-service.ts";
import { ProgressStepper } from "@/components/student/ProgressStepper.tsx";
import { SummaryConfirm, SummaryOpened } from "@/components/student/SummaryConfirm.tsx";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;
  const view = await getStudentOverview(student.id, id);
  if (!view) notFound();
  const { sa, assignment: a, content: c } = view;

  return (
    <>
      <SummaryOpened assignmentId={id} />
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href={`/ogrenci/gorevler/${id}`} style={{ textDecoration: "none" }}>← Görev detayına dön</Link>
        </p>
        <div className="editorial-kicker">5 DAKİKALIK KONU OKUMASI · {a.grade}. SINIF</div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}>
              {a.topic}
            </h1>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--accent)", borderColor: "var(--border)" }}>
                {a.subject}
              </span>
              <span className="badge">Temel Kavramlar & Özet</span>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Tahmini okuma: 4–6 dakika</span>
            </div>
          </div>
        </div>
      </div>

      <ProgressStepper status={sa.status === "NOT_STARTED" ? "READING" : sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <article className="editorial-panel" style={{ marginTop: 20, marginBottom: 20, background: "#ffffff" }}>
        <div className="editorial-panel-header" style={{ background: "var(--surface-subtle)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Ders Öncesi Hazırlık Metni</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Yarın sınıfta rahat takip edebilmen için özenle derlenmiştir</span>
          </div>
        </div>

        <div style={{ padding: "32px 32px" }}>
          {c.introduction && (
            <section style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
              <div className="editorial-kicker" style={{ color: "var(--accent)" }}>01 · GİRİŞ VE BAĞLAM</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: "4px 0 12px" }}>Konuya Giriş</h2>
              <p style={{ fontSize: "1.04rem", lineHeight: 1.75, color: "var(--text)", margin: 0 }}>{c.introduction}</p>
            </section>
          )}

          {c.keyConcepts.length > 0 && (
            <section style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
              <div className="editorial-kicker" style={{ color: "var(--accent)" }}>02 · KAVRAM SÖZLÜĞÜ</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: "4px 0 14px" }}>Temel Kavramlar</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {c.keyConcepts.map((k) => (
                  <div
                    key={k.term}
                    style={{
                      padding: "14px 18px",
                      background: "var(--surface-subtle)",
                      border: "1px solid var(--border)",
                      borderLeft: "3px solid var(--accent)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <dt style={{ fontWeight: 700, color: "var(--accent)", fontSize: "1rem", marginBottom: 4 }}>{k.term}</dt>
                    <dd style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.65, color: "var(--text)" }}>{k.explanation}</dd>
                  </div>
                ))}
              </div>
            </section>
          )}

          {c.summary && (
            <section style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
              <div className="editorial-kicker" style={{ color: "var(--accent)" }}>03 · ÖZ VE ANA FİKİR</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: "4px 0 12px" }}>Konu Özeti</h2>
              <p style={{ fontSize: "1.04rem", lineHeight: 1.8, color: "var(--text)", margin: 0, whiteSpace: "pre-wrap" }}>{c.summary}</p>
            </section>
          )}

          {c.simpleExample && (
            <section style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border)" }}>
              <div className="editorial-kicker" style={{ color: "var(--terracotta)" }}>04 · GÜNLÜK HAYATTAN ÖRNEK</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: "4px 0 12px" }}>Nasıl Düşünmeliyiz?</h2>
              <div style={{ padding: "16px 20px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--terracotta)" }}>
                <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.7, color: "var(--text)" }}>{c.simpleExample}</p>
              </div>
            </section>
          )}

          {c.mustKnow.length > 0 && (
            <section style={{ padding: "20px 22px", background: "var(--surface-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div className="editorial-kicker" style={{ color: "var(--accent)" }}>05 · DERS ÖNCESİ KONTROL LİSTESİ</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", margin: "4px 0 12px" }}>
                Derse Gelmeden Önce Bunları Bilmen Yeterli
              </h2>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: 8, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--text)" }}>
                {c.mustKnow.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </article>

      <div className="editorial-panel" style={{ padding: "24px 28px" }}>
        <SummaryConfirm assignmentId={id} status={sa.status} confirmed={Boolean(sa.summaryConfirmedAt)} />
      </div>
    </>
  );
}
