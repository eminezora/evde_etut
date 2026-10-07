"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
      <label htmlFor="email">E-posta Adresi</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="ornek@okul.k12.tr"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="password">Şifre</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className="error" role="alert">{error}</p>}

      <div style={{ marginTop: 20 }}>
        <button
          className="primary"
          type="submit"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy ? "Giriş yapılıyor…" : "Giriş Yap →"}
        </button>
      </div>

    </form>
  );
}
