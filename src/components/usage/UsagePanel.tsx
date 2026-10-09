// "Yapay zekâ kullanım hakkı" panel for the profile pages: the user's own quotas + recent usage.
import { getUsageSummary, listUsageHistory } from "@/lib/usage/usage-quota-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";
import { UsageMeter, toMeterData } from "./UsageMeter.tsx";

export async function UsagePanel({ user }: { user: { id: string; role: string } }) {
  const [quotas, history] = await Promise.all([getUsageSummary(user), listUsageHistory(user.id, undefined, 15)]);
  if (quotas.length === 0) return null;
  return (
    <div className="editorial-panel" style={{ marginBottom: 20 }}>
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Yapay zekâ kullanım hakkı</h2>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
          Yalnızca başarılı yapay zekâ kullanımları sayılır; hata veya zaman aşımında hakkınız iade edilir. Yenilenme saatleri Türkiye saatine göredir.
        </p>
      </div>
      <div className="usage-meter-list">
        {quotas.map((q) => (
          <UsageMeter key={q.feature} q={toMeterData(q)} />
        ))}
      </div>
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>Kullanım geçmişi</summary>
        {history.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>Henüz yapay zekâ kullanımı yok.</p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Tarih</th><th>Özellik</th><th>Miktar</th><th>Durum</th><th>Kalan hak</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.createdAt)}</td>
                    <td>{h.label}</td>
                    <td>{h.amount}</td>
                    <td>{h.status === "COMMITTED" ? "Kullanıldı" : "İade edildi"}</td>
                    <td>{h.status === "REFUNDED" ? "—" : h.remainingAfter === null ? "Sınırsız" : h.remainingAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
