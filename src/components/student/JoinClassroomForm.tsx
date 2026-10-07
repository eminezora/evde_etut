"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinClassroomForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const code = new FormData(form).get("code");
        setBusy(true);
        const res = await fetch("/api/classrooms/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const body = await res.json().catch(() => null);
        setBusy(false);
        if (!res.ok) return setMsg({ ok: false, text: body?.error ?? "Sınıfa katılınamadı." });
        form.reset();
        setMsg({ ok: true, text: `${body.data.name} sınıfına katıldın.` });
        router.refresh();
      }}
    >
      <label htmlFor="joincode">Sınıfa katıl</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input id="joincode" name="code" type="text" placeholder="Katılma kodu" autoComplete="off" required maxLength={40} style={{ textTransform: "uppercase" }} />
        <button className="primary" type="submit" disabled={busy}>{busy ? "…" : "Katıl"}</button>
      </div>
      {msg && <p className={msg.ok ? "muted" : "error"} role="status">{msg.text}</p>}
    </form>
  );
}
