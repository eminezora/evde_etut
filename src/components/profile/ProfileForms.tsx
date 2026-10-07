"use client";

// Profile forms: name update and password change / creation.
import { useRouter } from "next/navigation";
import { useState } from "react";

async function send(url: string, method: string, body: unknown) {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, json: await res.json().catch(() => null) };
  } catch {
    return { ok: false, json: { error: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin." } };
  }
}

export function NameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const { ok, json } = await send("/api/profile", "PATCH", { name });
        setBusy(false);
        setMsg(ok ? { ok: true, text: "Ad soyad güncellendi." } : { ok: false, text: json?.error ?? "Güncellenemedi." });
        if (ok) router.refresh();
      }}
    >
      <label htmlFor="profile-name">Ad Soyad</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input id="profile-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required />
        <button type="submit" className="primary" disabled={busy || name.trim() === initialName}>{busy ? "…" : "Kaydet"}</button>
      </div>
      {msg && <p className={msg.ok ? "notice-inline ok" : "error"} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const title = hasPassword ? "Şifre Değiştir" : "Parola Oluştur";

  if (!open) {
    return (
      <>
        {msg?.ok && <p className="notice-inline ok" role="status">{msg.text}</p>}
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }}>{title}</button>
      </>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== passwordConfirm) return setMsg({ ok: false, text: "Şifreler birbiriyle aynı değil." });
        setBusy(true);
        setMsg(null);
        const { ok, json } = await send("/api/profile/password", "POST", { currentPassword: hasPassword ? currentPassword : undefined, password, passwordConfirm });
        setBusy(false);
        if (!ok) return setMsg({ ok: false, text: json?.error ?? "Şifre güncellenemedi." });
        setCurrent("");
        setPassword("");
        setConfirm("");
        setOpen(false);
        setMsg({ ok: true, text: hasPassword ? "Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı." : "Parolanız oluşturuldu. Artık e-posta ve parolanızla da giriş yapabilirsiniz." });
        router.refresh();
      }}
    >
      {hasPassword && (
        <>
          <label htmlFor="current-password">Mevcut Şifre</label>
          <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        </>
      )}
      <label htmlFor="new-password">Yeni Şifre</label>
      <input id="new-password" type="password" autoComplete="new-password" placeholder="En az 8 karakter" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label htmlFor="new-password-confirm">Yeni Şifre (Tekrar)</label>
      <input id="new-password-confirm" type="password" autoComplete="new-password" minLength={8} value={passwordConfirm} onChange={(e) => setConfirm(e.target.value)} required />
      {msg && !msg.ok && <p className="error" role="alert">{msg.text}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" className="primary" disabled={busy}>{busy ? "Kaydediliyor…" : title}</button>
        <button type="button" className="ghost" onClick={() => { setOpen(false); setMsg(null); }}>Vazgeç</button>
      </div>
    </form>
  );
}
