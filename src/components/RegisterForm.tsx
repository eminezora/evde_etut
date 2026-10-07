"use client";

import Link from "next/link";
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
      body: JSON.stringify({ role, name: form.get("name"), email: form.get("email"), password: form.get("password"), teacherCode: form.get("teacherCode") ?? undefined }),
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
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600 }}>Hesap türü</legend>
        <div className="row">
          <label className="row" style={{ fontWeight: 400 }}><input type="radio" name="role" checked={role === "STUDENT"} onChange={() => setRole("STUDENT")} /> Öğrenci</label>
          <label className="row" style={{ fontWeight: 400 }}><input type="radio" name="role" checked={role === "TEACHER"} onChange={() => setRole("TEACHER")} /> Öğretmen</label>
        </div>
      </fieldset>
      <label htmlFor="name">Ad soyad</label>
      <input id="name" name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} />
      <label htmlFor="email">E-posta</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">Şifre (en az 8 karakter)</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      {role === "TEACHER" && (
        <>
          <label htmlFor="teacherCode">Öğretmen davet kodu</label>
          <input id="teacherCode" name="teacherCode" type="password" autoComplete="off" required />
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Kayıt ol"}</button>
        <Link href="/giris">Hesabın var mı? Giriş yap</Link>
      </div>
    </form>
  );
}
