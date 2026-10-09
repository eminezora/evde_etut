// Admin › Kullanım Limitleri: role defaults, per-user overrides and every user's current usage.
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user.ts";
import { adminUsageReport, listOverrides, listPolicies, QUOTA_ROLES, ROLE_FEATURES, USAGE_FEATURES, FEATURE_LABELS } from "@/lib/usage/usage-quota-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { OverrideManager, PoliciesTable, type PolicyRow } from "@/components/admin/UsageQuotaManager.tsx";

export const metadata = { title: "Kullanım Limitleri – DersBot Admin" };
const ROLE_LABELS: Record<string, string> = { TEACHER: "Öğretmen", STUDENT: "Öğrenci", ADMIN: "Yönetici" };

export default async function UsageLimitsPage({ searchParams }: { searchParams: Promise<{ rol?: string; ozellik?: string; dolanlar?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const role = QUOTA_ROLES.includes(sp.rol as never) ? sp.rol : undefined;
  const feature = USAGE_FEATURES.includes(sp.ozellik as never) ? sp.ozellik : undefined;
  const onlyFull = sp.dolanlar === "1";
  const search = sp.q?.trim().slice(0, 80) || undefined;

  const [policies, overrides, report] = await Promise.all([listPolicies(), listOverrides(), adminUsageReport({ role, feature, onlyFull, search })]);
  // Every role × feature row is shown, even before a policy exists (then it is created on save).
  const policyRows: PolicyRow[] = QUOTA_ROLES.flatMap((r) =>
    ROLE_FEATURES[r].map((f) => {
      const p = policies.find((x) => x.role === r && x.feature === f);
      return p ? { role: r, feature: f, periodType: p.periodType, limit: p.limit, unlimited: p.unlimited, isActive: p.isActive } : { role: r, feature: f, periodType: "DAILY", limit: 0, unlimited: true, isActive: false };
    }),
  );

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Kullanım Limitleri</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Yapay zekâ özelliklerinin rol bazlı varsayılan kotaları, kullanıcıya özel limitler ve güncel kullanım. Dönemler Türkiye saatine göre yenilenir (gün 00:00, hafta Pazartesi, ay 1&apos;i). Pasif veya sınırsız kota kullanımı sınırlamaz.
        </p>
      </div>

      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 12px" }}>Rol varsayılanları</h2>
        <PoliciesTable rows={policyRows} />
      </div>

      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 4px" }}>Kullanıcıya özel limit</h2>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>Özel limit, geçerli olduğu sürece rol varsayılanının yerine geçer. Bitiş tarihi verilirse o günün sonunda varsayılana dönülür.</p>
        <OverrideManager
          overrides={overrides.map((o) => ({
            id: o.id,
            userName: o.user.name,
            email: o.user.email,
            role: o.user.role,
            feature: o.feature,
            periodType: o.periodType,
            limit: o.limit,
            unlimited: o.unlimited,
            validUntil: o.validUntil ? formatDate(o.validUntil) : null,
            note: o.note,
          }))}
        />
      </div>

      <div className="editorial-panel">
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 12px" }}>Kullanıcıların güncel kullanımı</h2>
        <form method="get" className="row" style={{ gap: 10, marginBottom: 14, alignItems: "flex-end" }}>
          <div>
            <label htmlFor="f-rol">Rol</label>
            <select id="f-rol" name="rol" defaultValue={role ?? ""}>
              <option value="">Tümü</option>
              {QUOTA_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-ozellik">Kota tipi</label>
            <select id="f-ozellik" name="ozellik" defaultValue={feature ?? ""}>
              <option value="">Tümü</option>
              {USAGE_FEATURES.map((f) => <option key={f} value={f}>{FEATURE_LABELS[f]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-q">Ara</label>
            <input id="f-q" name="q" type="search" defaultValue={search ?? ""} placeholder="Ad veya e-posta" />
          </div>
          <label className="row" style={{ fontWeight: 400, gap: 6, margin: 0 }}>
            <input type="checkbox" name="dolanlar" value="1" defaultChecked={onlyFull} /> Yalnızca limiti dolanlar
          </label>
          <button type="submit">Filtrele</button>
          <Link href="/admin/kullanim-limitleri" style={{ fontSize: "0.85rem" }}>Sıfırla</Link>
        </form>
        {report.length === 0 ? (
          <p className="muted">Bu filtreye uyan kullanıcı yok.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Kullanıcı</th><th>Rol</th><th>Kota tipi</th><th>Kullanılan</th><th>Kalan</th><th>Limit</th><th>Yenilenme</th></tr></thead>
              <tbody>
                {report.map((r) => (
                  <tr key={`${r.user.id}-${r.feature}`}>
                    <td>{r.user.name}<div className="muted" style={{ fontSize: "0.78rem" }}>{r.user.email}</div></td>
                    <td>{ROLE_LABELS[r.user.role] ?? r.user.role}</td>
                    <td>{r.label}{r.source === "OVERRIDE" && <span className="badge" style={{ marginLeft: 6 }}>özel</span>}</td>
                    <td>{r.used}</td>
                    <td style={{ color: !r.unlimited && r.remaining === 0 ? "var(--danger-text)" : undefined, fontWeight: !r.unlimited && r.remaining === 0 ? 600 : undefined }}>{r.unlimited ? "—" : r.remaining}</td>
                    <td>{r.unlimited ? "Sınırsız" : `${r.limit} (${r.periodLabel.toLocaleLowerCase("tr-TR")})`}</td>
                    <td>{r.unlimited ? "—" : formatDate(r.periodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
