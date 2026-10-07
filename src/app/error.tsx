"use client";

import Link from "next/link";

// Generic error screen: never shows the error message or stack trace to the user.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "40px 32px" }} role="alert">
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>⚠️</div>
        <span className="badge" style={{ marginBottom: 12, background: "var(--danger-bg)", color: "var(--danger-text)", borderColor: "var(--danger-border)" }}>
          Sistem Hatası
        </span>
        <h1 style={{ fontSize: "1.75rem", margin: "8px 0 12px" }}>Bir Sorun Oluştu</h1>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 24 }}>
          İşlem gerçekleştirilirken beklenmeyen bir hata oluştu. Sayfayı yeniden deneyebilir ya da ana sayfaya dönebilirsiniz.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="primary" onClick={() => reset()}>
            🔄 Tekrar Dene
          </button>
          <Link className="button" href="/">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </main>
  );
}

