import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";

export const metadata = { title: "MEB Müfredat Durumu – DersBot Admin" };

export default async function AdminCurriculumPage() {
  await requireAdmin();

  const [
    grade5Count,
    grade6Count,
    grade7Count,
    grade8Count,
    verifiedCount,
    reviewRequiredCount,
    noSourceUrlCount,
    subjectsRaw,
  ] = await Promise.all([
    prisma.curriculumOutcome.count({ where: { grade: 5 } }),
    prisma.curriculumOutcome.count({ where: { grade: 6 } }),
    prisma.curriculumOutcome.count({ where: { grade: 7 } }),
    prisma.curriculumOutcome.count({ where: { grade: 8 } }),
    prisma.curriculumOutcome.count({ where: { reviewStatus: "VERIFIED" } }),
    prisma.curriculumOutcome.count({ where: { reviewStatus: "REVIEW_REQUIRED" } }),
    prisma.curriculumOutcome.count({ where: { sourceUrl: "" } }),
    prisma.curriculumOutcome.groupBy({
      by: ["subject", "grade"],
      _count: { id: true },
      orderBy: [{ subject: "asc" }, { grade: "asc" }],
    }),
  ]);

  const totalOutcomes = grade5Count + grade6Count + grade7Count + grade8Count;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="editorial-kicker">MÜFREDAT ARŞİVİ & DENETİM</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.45rem", fontWeight: 700 }}>MEB Müfredat Durumu</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          Sistemdeki ortaokul müfredat öğrenme çıktıları, sınıf ve ders bazlı dağılım (Salt Okunur).
        </p>
      </div>

      {/* Grade Metrics */}
      <div className="editorial-metrics" style={{ marginBottom: 24 }}>
        <div className="editorial-metric-card">
          <div className="label">5. Sınıf Kazanımları</div>
          <div className="value">{grade5Count}</div>
          <div className="meta">Kayıtlı öğrenme çıktısı</div>
        </div>

        <div className="editorial-metric-card">
          <div className="label">6. Sınıf Kazanımları</div>
          <div className="value">{grade6Count}</div>
          <div className="meta">Kayıtlı öğrenme çıktısı</div>
        </div>

        <div className="editorial-metric-card">
          <div className="label">7. Sınıf Kazanımları</div>
          <div className="value">{grade7Count}</div>
          <div className="meta">Kayıtlı öğrenme çıktısı</div>
        </div>

        <div className="editorial-metric-card">
          <div className="label">8. Sınıf Kazanımları</div>
          <div className="value">{grade8Count}</div>
          <div className="meta">Kayıtlı öğrenme çıktısı</div>
        </div>
      </div>

      {/* Verification Status */}
      <div className="editorial-panel" style={{ padding: "18px 22px", marginBottom: 24 }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: 12, letterSpacing: "-0.01em" }}>Doğrulama ve Kaynak Durumu</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: "0.88rem" }}>
          <div>
            Toplam Kayıt: <strong style={{ color: "var(--ink)" }}>{totalOutcomes}</strong>
          </div>
          <div>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--success)", marginRight: 6 }} />
            Doğrulanmış (VERIFIED): <strong style={{ color: "var(--success)" }}>{verifiedCount}</strong>
          </div>
          <div>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--warning)", marginRight: 6 }} />
            İnceleme Bekleyen: <strong style={{ color: "var(--warning)" }}>{reviewRequiredCount}</strong>
          </div>
          <div>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--border-strong)", marginRight: 6 }} />
            Kaynak URL Eksik: <strong style={{ color: "var(--ink-muted)" }}>{noSourceUrlCount}</strong>
          </div>
        </div>
      </div>

      {/* Breakdown by Subject and Grade Table */}
      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="editorial-panel-header" style={{ padding: "14px 20px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Ders ve Kademe Bazında Kazanım Dağılımı</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>Kayıtlı MEB müfredat öğeleri</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ders</th>
                <th>Kademe</th>
                <th>Kayıtlı Kazanım Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {subjectsRaw.map((s, idx) => (
                <tr key={`${s.subject}-${s.grade}-${idx}`}>
                  <td>
                    <strong>{s.subject}</strong>
                  </td>
                  <td>
                    <span className="badge badge-accent">{s.grade}. sınıf</span>
                  </td>
                  <td style={{ color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{s._count.id} kazanım</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
