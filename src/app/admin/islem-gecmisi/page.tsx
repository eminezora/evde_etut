import { requireAdmin } from "@/lib/auth/current-user.ts";
import { listAuditLogs } from "@/lib/admin/audit-service.ts";
import { formatDate } from "@/lib/assignments/format.ts";

export const metadata = { title: "İşlem Geçmişi (Audit Log) – Evde Etüt Admin" };

export default async function AdminAuditLogPage() {
  await requireAdmin();
  const logs = await listAuditLogs(100);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="editorial-kicker">GÜVENLİK VE DENETİM İZİ</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.45rem", fontWeight: 700 }}>İşlem Geçmişi (Audit Log)</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          Sistem yöneticileri tarafından gerçekleştirilen kritik operasyonların ve değişikliklerin denetim kayıtları.
        </p>
      </div>

      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="editorial-panel-header" style={{ padding: "14px 20px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Sistem Olay Günlüğü</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>Son 100 yönetici işlemi listeleniyor</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih / Saat</th>
                <th>Yönetici</th>
                <th>Eylem</th>
                <th>Varlık Türü</th>
                <th>Varlık ID</th>
                <th>Güvenli Detaylar</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Henüz kayıtlı bir audit log işlemi bulunmuyor.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{formatDate(l.createdAt)}</td>
                    <td>
                      {l.admin ? (
                        <>
                          <strong>{l.admin.name}</strong>
                          <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{l.admin.email}</span>
                        </>
                      ) : (
                        <span className="muted">Sistem / CLI</span>
                      )}
                    </td>
                    <td>
                      <span className="code" style={{ fontSize: "0.82rem", fontWeight: 600 }}>{l.action}</span>
                    </td>
                    <td>{l.entityType}</td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{l.entityId ?? "—"}</td>
                    <td style={{ fontSize: "0.8rem", maxWidth: 300, wordBreak: "break-all" }}>
                      {l.metadata ? JSON.stringify(l.metadata) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
