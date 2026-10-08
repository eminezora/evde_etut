import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";

export const metadata = { title: "MEB Müfredat Durumu – Evde Etüt Admin" };

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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>MEB Müfredat Durumu</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Sistemdeki ortaokul müfredat öğrenme çıktıları, sınıf ve ders bazlı dağılım (Salt Okunur).
        </p>
      </div>

      {/* Grade Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div style={{ backgroundColor: "#ffffff", padding: "16px 20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>5. Sınıf Kazanımları</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{grade5Count}</div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Öğrenme çıktısı</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", padding: "16px 20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>6. Sınıf Kazanımları</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{grade6Count}</div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Öğrenme çıktısı</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", padding: "16px 20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>7. Sınıf Kazanımları</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{grade7Count}</div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Öğrenme çıktısı</div>
        </div>

        <div style={{ backgroundColor: "#ffffff", padding: "16px 20px", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>8. Sınıf Kazanımları</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{grade8Count}</div>
          <div style={{ fontSize: "0.82rem", color: "#64748b" }}>Öğrenme çıktısı</div>
        </div>
      </div>

      {/* Verification Status */}
      <div style={{ backgroundColor: "#ffffff", padding: "18px 20px", border: "1px solid #e2e8f0", borderRadius: "10px", marginBottom: 28 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 12px" }}>Doğrulama ve Kaynak Durumu</h2>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: "0.9rem" }}>
          <div>
            Toplam Kayıt: <strong>{totalOutcomes}</strong>
          </div>
          <div>
            ✅ Doğrulanmış (VERIFIED): <strong style={{ color: "#059669" }}>{verifiedCount}</strong>
          </div>
          <div>
            ⚠️ İnceleme Bekleyen: <strong style={{ color: "#d97706" }}>{reviewRequiredCount}</strong>
          </div>
          <div>
            🔗 Kaynak URL Eksik: <strong>{noSourceUrlCount}</strong>
          </div>
        </div>
      </div>

      {/* Breakdown by Subject and Grade Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.95rem" }}>
          Ders ve Kademe Bazında Kazanım Dağılımı
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
                    <span className="badge">{s.grade}. sınıf</span>
                  </td>
                  <td>{s._count.id} kazanım</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
