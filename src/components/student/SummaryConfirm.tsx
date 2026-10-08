"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Records the first opening of the summary (server keeps the first timestamp). */
export function SummaryOpened({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch(`/api/student/assignments/${assignmentId}/open`, { method: "POST" }).then(() => router.refresh());
  }, [assignmentId, router]);
  return null;
}

export function SummaryConfirm({ assignmentId, status, confirmed }: { assignmentId: string; status: string; confirmed: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = `/ogrenci/gorevler/${assignmentId}/calisma`;

  if (confirmed) {
    return (
      <div className="editorial-panel" style={{ background: "var(--surface-subtle)" }}>
        <p style={{ margin: "0 0 12px", fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Özeti okuduğunu onayladın.
        </p>
        {["READY_FOR_ASSESSMENT", "ASSESSMENT_IN_PROGRESS", "NEEDS_REVIEW"].includes(status) && (
          <a className="button primary" href={next}>Ön Bilgi Kontrolüne Geç</a>
        )}
      </div>
    );
  }
  if (status === "EXPIRED") return <div className="editorial-panel"><p className="error" style={{ margin: 0 }}>Bu görevin son tarihi geçti.</p></div>;

  return (
    <form
      className="editorial-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!checked) return;
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/student/assignments/${assignmentId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        });
        setBusy(false);
        if (!res.ok) {
          setError((await res.json().catch(() => null))?.error ?? "Onay kaydedilemedi.");
          return;
        }
        router.push(next);
        router.refresh();
      }}
    >
      <label className="row" style={{ fontWeight: 600, flexWrap: "nowrap", cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
        <span>Özeti okudum ve temel kavramları anladım.</span>
      </label>
      {error && <p className="error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      <button className="primary" type="submit" disabled={!checked || busy} style={{ marginTop: 14 }}>
        {busy ? "Kaydediliyor…" : "Ön Bilgi Kontrolüne Geç"}
      </button>
    </form>
  );
}
