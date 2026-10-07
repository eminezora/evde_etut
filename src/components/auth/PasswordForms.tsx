"use client";

// Client forms for: forgot password, reset password, first-time Google sign-up (role choice).
import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, json: await res.json().catch(() => null) };
  } catch {
    return { ok: false, json: { error: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin." } };
  }
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/auth/password/forgot", { email });
    setBusy(false);
    if (!ok) return setError(json?.error ?? "İstek gönderilemedi.");
    setDone(json?.message ?? "Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.");
  }

  if (done) {
    return (
      <div role="status">
        <p className="notice-inline ok">{done}</p>
        <p className="muted" style={{ fontSize: "0.88rem" }}>E-postayı birkaç dakika içinde göremezseniz gereksiz (spam) klasörüne bakın. Bağlantı 30 dakika geçerlidir.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">E-posta Adresi</label>
      <input id="email" type="email" autoComplete="email" placeholder="ornek@okul.k12.tr" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 20 }}>
        {busy ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) return setError("Şifreler birbiriyle aynı değil.");
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/auth/password/reset", { token, password, passwordConfirm });
    setBusy(false);
    if (!ok) return setError(json?.error ?? "Şifre güncellenemedi.");
    router.replace("/giris?sifre=yenilendi");
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="password">Yeni Şifre</label>
      <input id="password" type="password" autoComplete="new-password" placeholder="En az 8 karakter" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label htmlFor="passwordConfirm">Yeni Şifre (Tekrar)</label>
      <input id="passwordConfirm" type="password" autoComplete="new-password" minLength={8} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 20 }}>
        {busy ? "Kaydediliyor…" : "Şifremi Güncelle"}
      </button>
    </form>
  );
}

export function GoogleRoleForm() {
  const router = useRouter();
  const [role, setRole] = useState<"STUDENT" | "TEACHER" | null>(null);
  const [teacherCode, setTeacherCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return setError("Lütfen öğrenci veya öğretmen olduğunuzu seçin.");
    setBusy(true);
    setError(null);
    const { ok, json } = await postJson("/api/auth/google/complete", { role, teacherCode: role === "TEACHER" ? teacherCode : undefined });
    setBusy(false);
    if (!ok) return setError(json?.error ?? "Hesap oluşturulamadı.");
    router.replace(json?.role === "TEACHER" ? "/ogretmen/siniflar" : "/ogrenci/gorevler");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <fieldset className="role-choice">
        <legend className="sr-only">Hesap türü</legend>
        <label className={`role-card${role === "STUDENT" ? " selected" : ""}`}>
          <input type="radio" name="role" value="STUDENT" checked={role === "STUDENT"} onChange={() => setRole("STUDENT")} />
          <span className="role-icon" aria-hidden="true">🎒</span>
          <strong>Öğrenciyim</strong>
          <span className="muted">Öğretmenimin verdiği sınıf koduyla sınıfa katılacağım.</span>
        </label>
        <label className={`role-card${role === "TEACHER" ? " selected" : ""}`}>
          <input type="radio" name="role" value="TEACHER" checked={role === "TEACHER"} onChange={() => setRole("TEACHER")} />
          <span className="role-icon" aria-hidden="true">🧑‍🏫</span>
          <strong>Öğretmenim</strong>
          <span className="muted">Okulumun verdiği öğretmen davet koduyla kayıt olacağım.</span>
        </label>
      </fieldset>
      {role === "TEACHER" && (
        <>
          <label htmlFor="teacherCode">Öğretmen Davet Kodu</label>
          <input id="teacherCode" type="password" autoComplete="off" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} required />
          <p className="muted" style={{ fontSize: "0.82rem", margin: "6px 0 0" }}>Google hesabı tek başına öğretmen yetkisi vermez; okulunuzun davet kodu gerekir.</p>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={busy || !role} style={{ width: "100%", justifyContent: "center", marginTop: 20 }}>
        {busy ? "Hesap oluşturuluyor…" : "Devam Et →"}
      </button>
    </form>
  );
}
