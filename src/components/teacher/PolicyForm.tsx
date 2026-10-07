"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Policy {
  maxAttempts: number;
  unlimitedAttempts: boolean;
  showExplanationsAfterSubmit: boolean;
  showAnswersAfterPass: boolean;
}

export function PolicyForm({ assignmentId, initial }: { assignmentId: string; initial: Policy }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch(`/api/assignments/${assignmentId}/policy`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
        setBusy(false);
        setMsg(res.ok ? { ok: true, text: "Ayarlar kaydedildi." } : { ok: false, text: (await res.json().catch(() => null))?.error ?? "Kaydedilemedi." });
        if (res.ok) router.refresh();
      }}
    >
      <h2>Deneme ve geri bildirim ayarları</h2>
      <label className="row" style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={p.unlimitedAttempts} onChange={(e) => setP({ ...p, unlimitedAttempts: e.target.checked })} /> Sınırsız deneme
      </label>
      {!p.unlimitedAttempts && (
        <>
          <label htmlFor="maxAttempts">En fazla deneme sayısı</label>
          <input id="maxAttempts" type="number" min={1} max={20} value={p.maxAttempts} onChange={(e) => setP({ ...p, maxAttempts: Number(e.target.value) })} style={{ maxWidth: 120 }} />
        </>
      )}
      <label className="row" style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={p.showExplanationsAfterSubmit} onChange={(e) => setP({ ...p, showExplanationsAfterSubmit: e.target.checked })} /> Gönderimden sonra soru bazında doğru/yanlış ve açıklamaları göster
      </label>
      <label className="row" style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={p.showAnswersAfterPass} onChange={(e) => setP({ ...p, showAnswersAfterPass: e.target.checked })} /> “Derse hazır” olduktan sonra doğru cevapları göster
      </label>
      <button className="primary" type="submit" disabled={busy} style={{ marginTop: 10 }}>{busy ? "Kaydediliyor…" : "Ayarları Kaydet"}</button>
      {msg && <p className={msg.ok ? "muted" : "error"} role="status">{msg.text}</p>}
    </form>
  );
}
