// Shared frame of the sign-in, sign-up and password pages.
import Link from "next/link";

export function AuthShell({ icon, title, subtitle, children, footer, width = 460 }: { icon: string; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, var(--bg) 0%, var(--surface-subtle) 100%)" }}>
      <header className="top" style={{ borderBottom: "none", background: "transparent" }}>
        <Link href="/" className="brand-badge">
          <span className="brand-icon">📚</span>
          <span>Evde Etüt</span>
        </Link>
        <Link href="/" className="button ghost" style={{ minHeight: 36, padding: "6px 14px" }}>
          ← Ana Sayfa
        </Link>
      </header>
      <main style={{ maxWidth: width, margin: "auto", width: "100%", padding: "20px 16px 60px" }}>
        <div className="card" style={{ padding: "32px 28px", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span className="brand-icon" style={{ width: 44, height: 44, fontSize: "1.4rem", margin: "0 auto 12px" }}>{icon}</span>
            <h1 style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>{title}</h1>
            {subtitle && <p className="muted" style={{ fontSize: "0.92rem", margin: 0 }}>{subtitle}</p>}
          </div>
          {children}
          {footer && (
            <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: "0.92rem" }}>{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}

/** "Google ile devam et" – a plain link to the OAuth start route (rendered only when Google is configured). */
export function GoogleButton() {
  return (
    <>
      <a href="/api/auth/google" className="button google-button">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Google ile devam et
      </a>
      <div className="auth-divider" role="separator"><span>veya e-posta ile</span></div>
    </>
  );
}

export const GOOGLE_ERRORS: Record<string, string> = {
  "google-kapali": "Google ile giriş şu anda kullanılamıyor. Lütfen e-posta ve şifre ile devam edin.",
  "google-iptal": "Google ile giriş iptal edildi.",
  "google-hata": "Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.",
  "google-dogrulanmamis": "Google hesabınızın e-posta adresi doğrulanmamış. Lütfen e-posta ve şifre ile devam edin.",
  "google-baska-hesap": "Bu e-posta adresi başka bir Google hesabına bağlı.",
  "cok-deneme": "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.",
};
