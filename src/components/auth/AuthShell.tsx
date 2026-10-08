// Shared frame of the sign-in, sign-up and password pages in Editorial Learning Workspace design.
import Link from "next/link";

export function AuthShell({
  icon,
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg)" }}>
      {/* Editorial Header */}
      <header className="top" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <Link href="/" className="brand-badge">
          <span className="brand-icon">✎</span>
          <span>Evde Etüt</span>
        </Link>
        <Link href="/" className="button ghost" style={{ minHeight: 34, padding: "4px 12px", fontSize: "0.85rem" }}>
          ← Ana Sayfa
        </Link>
      </header>

      {/* Main Form Center */}
      <main style={{ maxWidth: width, margin: "auto", width: "100%", padding: "40px 16px 80px" }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            padding: "32px 30px",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <span className="kicker" style={{ margin: 0 }}>GÜVENLİ ERİŞİM</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              {icon && <span style={{ fontSize: "1.4rem", display: "inline-flex", alignItems: "center" }}>{icon}</span>}
              <h1 style={{ fontSize: "1.55rem", margin: 0 }}>{title}</h1>
            </div>
            {subtitle && (
              <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "var(--muted)" }}>
                {subtitle}
              </p>
            )}
          </div>

          {children}

          {footer && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
                fontSize: "0.88rem",
                color: "var(--text-secondary)",
                textAlign: "center",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** "Google ile devam et" – OAuth start route button styled with editorial precision. */
export function GoogleButton() {
  return (
    <>
      <a
        href="/api/auth/google"
        className="button"
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: 10,
          marginBottom: 16,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
          fontWeight: 600,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        <span>Google ile Giriş Yap</span>
      </a>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "12px 0 16px",
          color: "var(--muted)",
          fontSize: "0.8rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
        role="separator"
      >
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span>veya e-posta ile</span>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
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
