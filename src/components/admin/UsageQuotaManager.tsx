"use client";

// Admin: role default quotas (editable rows) and per-user overrides.
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PolicyRow {
  role: string;
  feature: string;
  periodType: string;
  limit: number;
  unlimited: boolean;
  isActive: boolean;
}
export interface OverrideRow {
  id: string;
  userName: string;
  email: string;
  role: string;
  feature: string;
  periodType: string;
  limit: number;
  unlimited: boolean;
  validUntil: string | null;
  note: string | null;
}

const ROLE_LABELS: Record<string, string> = { TEACHER: "Öğretmen", STUDENT: "Öğrenci", ADMIN: "Yönetici" };
const FEATURE_LABELS: Record<string, string> = { AI_CONTENT_GENERATION: "AI Ders Taslağı", AI_ASSISTANT_MESSAGE: "DersBot Sohbet" };
const PERIODS = [
  { v: "DAILY", l: "Günlük" },
  { v: "WEEKLY", l: "Haftalık" },
  { v: "MONTHLY", l: "Aylık" },
];

async function send(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, error: json?.error as string | undefined };
  } catch {
    return { ok: false, error: "Sunucuya bağlanılamadı." };
  }
}

function PolicyEditor({ row }: { row: PolicyRow }) {
  const router = useRouter();
  const [p, setP] = useState(row);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `${row.role}-${row.feature}`;
  const changed = JSON.stringify(p) !== JSON.stringify(row);
  return (
    <tr>
      <td>{ROLE_LABELS[p.role] ?? p.role}</td>
      <td>{FEATURE_LABELS[p.feature] ?? p.feature}</td>
      <td>
        <label htmlFor={`period-${id}`} className="sr-only">Periyot</label>
        <select id={`period-${id}`} value={p.periodType} onChange={(e) => setP({ ...p, periodType: e.target.value })} style={{ minWidth: 110 }}>
          {PERIODS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
        </select>
      </td>
      <td>
        <label htmlFor={`limit-${id}`} className="sr-only">Limit</label>
        <input id={`limit-${id}`} type="number" min={0} max={100000} value={p.unlimited ? "" : p.limit} disabled={p.unlimited} onChange={(e) => setP({ ...p, limit: Number(e.target.value) })} style={{ width: 90 }} />
      </td>
      <td><input aria-label="Sınırsız" type="checkbox" checked={p.unlimited} onChange={(e) => setP({ ...p, unlimited: e.target.checked })} /></td>
      <td><input aria-label="Aktif" type="checkbox" checked={p.isActive} onChange={(e) => setP({ ...p, isActive: e.target.checked })} /></td>
      <td>
        <button
          type="button"
          className="primary"
          disabled={busy || !changed}
          onClick={async () => {
            setBusy(true);
            const r = await send("/api/admin/usage/policies", "PUT", p);
            setBusy(false);
            setMsg(r.ok ? { ok: true, text: "Kaydedildi" } : { ok: false, text: r.error ?? "Kaydedilemedi" });
            if (r.ok) router.refresh();
          }}
          style={{ minHeight: 30, padding: "2px 12px", fontSize: "0.82rem" }}
        >
          {busy ? "…" : "Kaydet"}
        </button>
        {msg && <div style={{ fontSize: "0.78rem", color: msg.ok ? "var(--ok-text)" : "var(--danger-text)" }}>{msg.text}</div>}
      </td>
    </tr>
  );
}

export function PoliciesTable({ rows }: { rows: PolicyRow[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Rol</th><th>Özellik</th><th>Periyot</th><th>Limit</th><th>Sınırsız</th><th>Aktif</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <PolicyEditor key={`${r.role}-${r.feature}`} row={r} />)}
        </tbody>
      </table>
    </div>
  );
}

export function OverrideManager({ overrides }: { overrides: OverrideRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", feature: "AI_CONTENT_GENERATION", periodType: "DAILY", limit: 20, unlimited: false, validUntil: "", note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    // validUntil is picked as a Türkiye date: valid through the end of that day (23:59 TR).
    const validUntil = form.validUntil ? new Date(`${form.validUntil}T23:59:59+03:00`).toISOString() : null;
    const r = await send("/api/admin/usage/overrides", "POST", { ...form, validUntil });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Özel limit kaydedildi." } : { ok: false, text: r.error ?? "Kaydedilemedi." });
    if (r.ok) router.refresh();
  }

  return (
    <>
      <form onSubmit={save} className="override-form">
        <div>
          <label htmlFor="ov-email">Kullanıcı e-postası</label>
          <input id="ov-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@okul.k12.tr" />
        </div>
        <div>
          <label htmlFor="ov-feature">Özellik</label>
          <select id="ov-feature" value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })}>
            {Object.entries(FEATURE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ov-period">Periyot</label>
          <select id="ov-period" value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
            {PERIODS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ov-limit">Limit</label>
          <input id="ov-limit" type="number" min={0} max={100000} value={form.unlimited ? "" : form.limit} disabled={form.unlimited} onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })} />
        </div>
        <div>
          <label htmlFor="ov-until">Bitiş tarihi (isteğe bağlı)</label>
          <input id="ov-until" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
        </div>
        <div>
          <label htmlFor="ov-note">Not</label>
          <input id="ov-note" type="text" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="ör. Sınav haftası için" />
        </div>
        <label className="row" style={{ fontWeight: 400, gap: 6, margin: 0, alignSelf: "end" }}>
          <input type="checkbox" checked={form.unlimited} onChange={(e) => setForm({ ...form, unlimited: e.target.checked })} /> Sınırsız
        </label>
        <button type="submit" className="primary" disabled={busy} style={{ alignSelf: "end" }}>{busy ? "Kaydediliyor…" : "Özel limit ver"}</button>
      </form>
      {msg && <p className={msg.ok ? "notice-inline ok" : "error"} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}

      {overrides.length > 0 && (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Kullanıcı</th><th>Rol</th><th>Özellik</th><th>Limit</th><th>Geçerlilik</th><th>Not</th><th></th></tr></thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.id}>
                  <td>{o.userName}<div className="muted" style={{ fontSize: "0.78rem" }}>{o.email}</div></td>
                  <td>{ROLE_LABELS[o.role] ?? o.role}</td>
                  <td>{FEATURE_LABELS[o.feature] ?? o.feature}</td>
                  <td>{o.unlimited ? "Sınırsız" : `${o.limit} / ${PERIODS.find((x) => x.v === o.periodType)?.l.toLocaleLowerCase("tr-TR")}`}</td>
                  <td>{o.validUntil ?? "Süresiz"}</td>
                  <td>{o.note ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="danger-ghost"
                      onClick={async () => {
                        const r = await send(`/api/admin/usage/overrides?id=${encodeURIComponent(o.id)}`, "DELETE");
                        if (r.ok) router.refresh();
                        else setMsg({ ok: false, text: r.error ?? "Silinemedi." });
                      }}
                      style={{ minHeight: 30, padding: "2px 10px", fontSize: "0.8rem" }}
                    >
                      Kaldır
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
