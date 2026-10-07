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
      <p><Link href={`/ogrenci/gorevler/${id}`}>← Göreve dön</Link></p>
      <h1>{a.topic}</h1>
      <ProgressStepper status={sa.status === "NOT_STARTED" ? "READING" : sa.status} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />
      <article className="card reading">
        <section>
          <h2>Konuya Giriş</h2>
          <p>{c.introduction}</p>
        </section>
        {c.keyConcepts.length > 0 && (
          <section>
            <h2>Temel Kavramlar</h2>
            <dl className="concepts">
              {c.keyConcepts.map((k) => (
                <div key={k.term}>
                  <dt>{k.term}</dt>
                  <dd>{k.explanation}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section>
          <h2>Konu Özeti</h2>
          <p>{c.summary}</p>
        </section>
        {c.simpleExample && (
          <section>
            <h2>Basit Örnek</h2>
            <p>{c.simpleExample}</p>
          </section>
        )}
        {c.mustKnow.length > 0 && (
          <section className="info">
            <h2>Derse gelmeden önce bunları bilmen yeterli</h2>
            <ul>{c.mustKnow.map((m) => <li key={m}>{m}</li>)}</ul>
          </section>
        )}
      </article>
      <SummaryConfirm assignmentId={id} status={sa.status} confirmed={Boolean(sa.summaryConfirmedAt)} />
    </>
  );
}
