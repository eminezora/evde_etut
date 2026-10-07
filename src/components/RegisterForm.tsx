"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        teacherCode: form.get("teacherCode") ?? undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Kayıt yapılamadı.");
      return;
    }
    router.replace(role === "TEACHER" ? "/ogretmen/siniflar" : "/ogrenci/gorevler");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {/* Role Selection Segmented Control */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ margin: "0 0 8px" }}>Hesap Türü Seçin</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 4, background: "var(--surface-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setRole("STUDENT")}
            className={role === "STUDENT" ? "primary" : "ghost"}
            style={{
              minHeight: 38,
              borderRadius: "var(--radius-sm)",
              boxShadow: role === "STUDENT" ? "var(--shadow-xs)" : "none",
            }}
          >
            🎓 Öğrenci
          </button>
          <button
            type="button"
            onClick={() => setRole("TEACHER")}
            className={role === "TEACHER" ? "primary" : "ghost"}
            style={{
              minHeight: 38,
              borderRadius: "var(--radius-sm)",
              boxShadow: role === "TEACHER" ? "var(--shadow-xs)" : "none",
            }}
          >
            👨‍🏫 Öğretmen
          </button>
        </div>
      </div>

      <label htmlFor="name">Ad Soyad</label>
      <input
        id="name"
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Örn. Ayşe Yılmaz"
        required
        minLength={2}
        maxLength={80}
      />

      <label htmlFor="email">E-posta Adresi</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="ornek@okul.k12.tr"
        required
      />

      <label htmlFor="password">Şifre</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="En az 8 karakter"
        required
        minLength={8}
      />

      {role === "TEACHER" && (
        <div style={{ marginTop: 14 }}>
          <label htmlFor="teacherCode">Öğretmen Davet Kodu</label>
          <input
            id="teacherCode"
            name="teacherCode"
            type="password"
            autoComplete="off"
            placeholder="Okul veya sistem yöneticisi kodu"
            required
          />
          <p className="muted" style={{ fontSize: "0.82rem", margin: "4px 0 0" }}>
            Öğretmen hesabı oluşturabilmek için okulunuz tarafından verilen davet kodunu giriniz.
          </p>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div style={{ marginTop: 22 }}>
        <button
          className="primary"
          type="submit"
          disabled={busy}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {busy ? "Hesap Oluşturuluyor…" : `${role === "STUDENT" ? "Öğrenci" : "Öğretmen"} Olarak Kayıt Ol →`}
        </button>
      </div>
    </form>
  );
}
