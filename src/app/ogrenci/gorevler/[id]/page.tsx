// Assignment overview: task info, progress stepper, introduction and the next action.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentOverview } from "@/lib/assessment/student-assessment-service.ts";
import { STATUS_LABELS, type StudentStatus } from "@/lib/assessment/status-machine.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { ProgressStepper } from "@/components/student/ProgressStepper.tsx";

export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await requireStudent();
  const { id } = await params;
  const view = await getStudentOverview(student.id, id);
  if (!view) notFound();
  const { sa, assignment: a, content } = view;
  const s = sa.status;
  const next =
    s === "NOT_STARTED" || s === "READING"
      ? { href: `/ogrenci/gorevler/${id}/ozet`, label: s === "NOT_STARTED" ? "Konu Özetine Başla →" : "Konu Özetine Devam Et →" }
      : s === "READY_FOR_ASSESSMENT" || s === "ASSESSMENT_IN_PROGRESS"
        ? { href: `/ogrenci/gorevler/${id}/calisma`, label: s === "READY_FOR_ASSESSMENT" ? "Ön Bilgi Kontrolüne Geç →" : "Ön Bilgi Kontrolüne Devam Et →" }
        : s === "EXPIRED"
          ? null
          : { href: `/ogrenci/gorevler/${id}/sonuc`, label: "Sonucu ve Raporu Gör →" };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.88rem" }}>
          <Link href="/ogrenci/gorevler" style={{ textDecoration: "none" }}>← Görevlerime dön</Link>
        </p>
        <div className="editorial-kicker">ÖĞRENCİ ÇALIŞMA PLANI · {a.grade}. SINIF</div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}>
              {a.topic}
            </h1>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--accent)", borderColor: "var(--border)" }}>
                {a.subject}
              </span>
              <span className={`badge ${s}`}>
                {STATUS_LABELS[s as StudentStatus] ?? s}
              </span>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {a.classroom} · {a.teacher}
              </span>
            </div>
          </div>
          {next && (
            <Link className="button primary" href={next.href} style={{ padding: "10px 20px", fontSize: "0.95rem" }}>
              {next.label}
            </Link>
          )}
        </div>
      </div>

      <ProgressStepper status={s} summaryConfirmed={Boolean(sa.summaryConfirmedAt)} />

      <div className="editorial-panel" style={{ marginTop: 20, marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Görev Parametreleri</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Bu çalışmanın kuralları ve teslim bilgileri</span>
          </div>
          <span className="badge" style={{ background: "var(--surface-subtle)", color: "var(--muted)" }}>
            Hedef: %{a.minimumScore} Hazır Bulunuşluk
          </span>
        </div>

        <div style={{ padding: "18px 20px" }}>
          <dl className="details" style={{ margin: 0 }}>
            <dt>Ders & Kademe</dt>
            <dd><strong>{a.subject}</strong> · {a.grade}. Sınıf</dd>
            <dt>Sınıf & Öğretmen</dt>
            <dd>{a.classroom} · {a.teacher}</dd>
            <dt>Ünite / Tema</dt>
            <dd>{a.unitOrTheme}</dd>
            <dt>Son Teslim Tarihi</dt>
            <dd><time>{formatDate(a.deadline)}</time></dd>
            <dt>Hazır Olma Eşiği</dt>
            <dd>%{a.minimumScore} ve üzeri puan</dd>
            <dt>Ön Bilgi Soruları</dt>
            <dd>{a.questionCount} soru · {a.policy.max === null ? "Sınırsız deneme imkanı" : `${a.policy.used} / ${a.policy.max} deneme hakkı kullanıldı`}</dd>
            <dt>Güncel Durum</dt>
            <dd><span className={`badge ${s}`}>{STATUS_LABELS[s as StudentStatus] ?? s}</span></dd>
          </dl>
        </div>
      </div>

      <div className="editorial-panel" style={{ borderLeft: "4px solid var(--accent)" }}>
        <div className="editorial-panel-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-serif)" }}>Ön Hazırlık Rehberi</h2>
            <span className="muted" style={{ fontSize: "0.82rem" }}>Derse girmeden önce bilmen gereken temel bağlam</span>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <p style={{ whiteSpace: "pre-wrap", fontSize: "1.02rem", lineHeight: 1.7, color: "var(--text)", margin: "0 0 20px" }}>
            {content.introduction || "Bu görev için ön hazırlık girişi henüz tanımlanmamıştır."}
          </p>

          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface-subtle)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              borderLeft: "3px solid var(--accent)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            <strong style={{ color: "var(--accent)" }}>Öğrenci Notu:</strong> Bu çalışmanın amacı konuyu önceden ezberlemeniz değil; yarın sınıfta öğretmeninizi rahatça anlayabilmeniz için gereken temel terimleri hatırlamanızdır.
          </div>

          {s === "EXPIRED" && (
            <p className="notice-inline error" role="alert">
              Bu görevin son teslim tarihi dolmuştur; yeni deneme başlatılamaz.
            </p>
          )}

          {next && (
            <div style={{ marginTop: 16 }}>
              <Link className="button primary" href={next.href} style={{ padding: "12px 24px", fontSize: "1rem" }}>
                {next.label}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
