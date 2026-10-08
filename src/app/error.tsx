"use client";

import Link from "next/link";

// Generic error screen: never shows the error message or stack trace to the user.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="editorial-panel" style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "48px 36px" }} role="alert">
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--danger-bg)", color: "var(--danger)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="editorial-kicker" style={{ color: "var(--danger)" }}>SİSTEM HATASI</div>
        <h1 style={{ fontSize: "1.65rem", margin: "6px 0 12px", fontWeight: 700 }}>Beklenmeyen Bir Hata Oluştu</h1>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 28, fontSize: "0.92rem" }}>
          İşlem gerçekleştirilirken bir sorun meydana geldi. Sayfayı yeniden deneyebilir ya da güvenli ana sayfaya dönebilirsiniz.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="primary" onClick={() => reset()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Tekrar Dene
          </button>
          <Link className="button" href="/">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </main>
  );
}

