"use client";

import Link from "next/link";
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
    let data: { error?: string; message?: string; role?: string } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      setError(
        data?.error ||
        data?.message ||
        (res.status === 401
          ? "E-posta veya şifre hatalı."
          : res.status === 429
          ? "Çok fazla deneme yapıldı. Lütfen biraz bekleyin."
          : "Giriş yapılamadı. Sunucu bağlantısını kontrol edin.")
      );
      return;
    }
    if (data?.role) {
      router.replace(data.role === "STUDENT" ? "/ogrenci/gorevler" : "/ogretmen/gorevler");
      router.refresh();
    }
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

      <div className="label-row">
        <label htmlFor="password">Şifre</label>
        <Link href="/sifremi-unuttum">Şifremi unuttum</Link>
      </div>
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
