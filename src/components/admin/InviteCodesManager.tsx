"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/assignments/format.ts";

interface TeacherInviteCodeItem {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | Date | null;
  createdAt: string | Date;
  createdBy?: { id: string; name: string; email: string } | null;
  usages: {
    id: string;
    usedAt: string | Date;
    teacher: { id: string; name: string; email: string; createdAt: string | Date };
  }[];
}

export function InviteCodesManager({ initialCodes }: { initialCodes: TeacherInviteCodeItem[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState<TeacherInviteCodeItem[]>(initialCodes);
  const [createOpen, setCreateOpen] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses: Number(maxUses),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kod oluşturulamadı.");
      } else {
        setSuccess(`Yeni davet kodu oluşturuldu: ${data.data.code}`);
        setCreateOpen(false);
        setMaxUses(1);
        setExpiresAt("");
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(codeId: string, currentStatus: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invite-codes/${codeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        setCodes((prev) =>
          prev.map((c) => (c.id === codeId ? { ...c, isActive: !currentStatus } : c))
        );
        router.refresh();
      } else {
        setError("Durum değiştirilemedi.");
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 600 }}>Öğretmen Davet Kodları</h2>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Öğretmenlerin sisteme kayıt olmasını sağlayan kriptografik güvenli kodlar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setCreateOpen(true);
          }}
          className="button primary"
          style={{ minHeight: 36, fontSize: "0.88rem" }}
        >
          + Yeni Davet Kodu Üret
        </button>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="notice-inline ok" style={{ marginBottom: 16 }}>{success}</div>}

      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Davet Kodu</th>
                <th>Kullanım</th>
                <th>Son Geçerlilik</th>
                <th>Durum</th>
                <th>Oluşturan</th>
                <th>Kullanan Öğretmenler</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Henüz kayıtlı bir davet kodu bulunmuyor.
                  </td>
                </tr>
              ) : (
                codes.map((c) => {
                  const isExpired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                  const isExhausted = c.usedCount >= c.maxUses;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="code" style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.08em" }}>
                          {c.code}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{c.usedCount}</span> / {c.maxUses}
                        {isExhausted && <span style={{ color: "#dc2626", marginLeft: 6, fontSize: "0.75rem" }}>(Doldu)</span>}
                      </td>
                      <td>
                        {c.expiresAt ? formatDate(c.expiresAt) : "Süresiz"}
                        {isExpired && <span style={{ color: "#dc2626", marginLeft: 6, fontSize: "0.75rem" }}>(Süresi Geçti)</span>}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: c.isActive && !isExpired && !isExhausted ? "var(--ok-bg)" : "var(--warn-bg)",
                            color: c.isActive && !isExpired && !isExhausted ? "var(--ok-text)" : "var(--warn-text)",
                            borderColor: c.isActive && !isExpired && !isExhausted ? "var(--ok-border)" : "var(--warn-border)",
                          }}
                        >
                          {c.isActive ? (isExpired ? "Süresi Geçmiş" : isExhausted ? "Tükendi" : "Aktif") : "Pasif"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem" }}>{c.createdBy?.name ?? "Sistem"}</span>
                      </td>
                      <td>
                        {c.usages.length === 0 ? (
                          <span className="muted" style={{ fontSize: "0.82rem" }}>Henüz kullanılmadı</span>
                        ) : (
                          <div style={{ fontSize: "0.82rem" }}>
                            {c.usages.map((u) => (
                              <div key={u.id}>
                                {u.teacher.name} <span className="muted">({formatDate(u.usedAt)})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleStatus(c.id, c.isActive)}
                          disabled={busy}
                          className="button"
                          style={{ minHeight: 28, padding: "2px 8px", fontSize: "0.78rem" }}
                        >
                          {c.isActive ? "Pasife Al" : "Aktif Et"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Yeni Öğretmen Davet Kodu</h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="max-uses">Maksimum Kullanım Sayısı</label>
                <select
                  id="max-uses"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                >
                  <option value={1}>1 Kullanım (Tek Seferlik)</option>
                  <option value={5}>5 Kullanım</option>
                  <option value={10}>10 Kullanım</option>
                  <option value={20}>20 Kullanım</option>
                  <option value={100}>100 Kullanım (Geniş Kontenjan)</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="expires-at">Son Geçerlilik Tarihi (İsteğe bağlı)</label>
                <input
                  id="expires-at"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setCreateOpen(false)} className="button">
                  Vazgeç
                </button>
                <button type="submit" disabled={busy} className="button primary">
                  {busy ? "Üretiliyor..." : "Kodu Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
