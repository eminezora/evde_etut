"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewForm({ answerId, maxPoints }: { answerId: string; maxPoints: number }) {
  const router = useRouter();
  const [points, setPoints] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(points);
        if (points === "" || !Number.isFinite(n) || n < 0 || n > maxPoints) {
          setError(`Puan 0 ile ${maxPoints} arasında olmalıdır.`);
          return;
        }
        setBusy(true);
        setError(null);
        const res = await fetch(`/api/teacher/answers/${answerId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ awardedPoints: n, feedback }),
        });
        setBusy(false);
        if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Kaydedilemedi.");
        else router.refresh();
      }}
    >
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <label htmlFor={`p-${answerId}`}>Puan (0–{maxPoints})</label>
          <input id={`p-${answerId}`} type="number" min={0} max={maxPoints} step={0.5} value={points} onChange={(e) => setPoints(e.target.value)} style={{ maxWidth: 120 }} required />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor={`f-${answerId}`}>Kısa geri bildirim (isteğe bağlı)</label>
          <input id={`f-${answerId}`} type="text" maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Puanı Kaydet"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
