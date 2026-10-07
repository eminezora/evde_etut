"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Giriş yapılamadı.");
      return;
    }
    const { role } = await res.json();
    router.replace(role === "STUDENT" ? "/ogrenci/gorevler" : "/ogretmen/gorevler");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">E-posta</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Şifre</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
      </div>
    </form>
  );
}
