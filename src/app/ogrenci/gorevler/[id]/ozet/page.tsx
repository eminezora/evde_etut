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
      <div style={{ marginBottom: 16 }}>
        <p className="muted" style={{ marginBottom: 6 }}>
          <Link href={`/ogrenci/gorevler/${id}`}>← Göreve dön</Link>
        </p>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            {a.subject}
          </span>
          <span className="badge">5 Dakikalık Konu Özeti</span>
        </div>
        <h1 style={{ margin: "4px 0 0" }}>{a.topic}</h1>
      </div>

      <ProgressStepper status={sa.status === "NOT_STARTED" ? "READING" : sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <article className="card reading" style={{ padding: "32px 28px", boxShadow: "var(--shadow-md)" }}>
        {c.introduction && (
          <section>
            <h2>Konuya Giriş</h2>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>{c.introduction}</p>
          </section>
        )}

        {c.keyConcepts.length > 0 && (
          <section>
            <h2>Temel Kavramlar</h2>
            <dl className="concepts">
              {c.keyConcepts.map((k) => (
                <div key={k.term}>
                  <dt style={{ color: "var(--accent)" }}>{k.term}</dt>
                  <dd style={{ fontSize: "0.95rem", lineHeight: 1.6 }}>{k.explanation}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {c.summary && (
          <section>
            <h2>Konu Özeti</h2>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>{c.summary}</p>
          </section>
        )}

        {c.simpleExample && (
          <section>
            <h2>Günlük Hayattan Basit Örnek</h2>
            <div style={{ padding: "14px 18px", background: "var(--surface-subtle)", borderRadius: "var(--radius-md)", borderLeft: "4px solid var(--ok)" }}>
              <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.6 }}>{c.simpleExample}</p>
            </div>
          </section>
        )}

        {c.mustKnow.length > 0 && (
          <section className="info" style={{ marginTop: 24, padding: "18px 20px" }}>
            <h2 style={{ color: "var(--info-text)", fontSize: "1.15rem", marginBottom: 10 }}>
              💡 Derse Gelmeden Önce Bunları Bilmen Yeterli
            </h2>
            <ul style={{ margin: 0, paddingLeft: "1.4rem", display: "grid", gap: 6, fontSize: "0.95rem" }}>
              {c.mustKnow.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <div className="card" style={{ padding: "24px" }}>
        <SummaryConfirm assignmentId={id} status={sa.status} confirmed={Boolean(sa.summaryConfirmedAt)} />
      </div>
    </>
  );
}
