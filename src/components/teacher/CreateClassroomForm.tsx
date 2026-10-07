"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateClassroomForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/classrooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), grade: data.get("grade") }) });
        setBusy(false);
        if (!res.ok) return setError((await res.json().catch(() => null))?.error ?? "Sınıf oluşturulamadı.");
        form.reset();
        router.refresh();
      }}
    >
      <h2>Yeni sınıf</h2>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <label htmlFor="cname">Sınıf adı</label>
          <input id="cname" name="name" type="text" placeholder="7/A" required maxLength={40} />
        </div>
        <div>
          <label htmlFor="cgrade">Sınıf düzeyi</label>
          <select id="cgrade" name="grade" defaultValue="5">
            {[5, 6, 7, 8].map((g) => <option key={g} value={g}>{g}. sınıf</option>)}
          </select>
        </div>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Oluşturuluyor…" : "Sınıf Oluştur"}</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
