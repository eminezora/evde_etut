import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="editorial-panel" style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "48px 36px" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-subtle)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div className="editorial-kicker">HATA 404</div>
        <h1 style={{ fontSize: "1.65rem", margin: "6px 0 12px", fontWeight: 700 }}>Sayfa Bulunamadı</h1>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 28, fontSize: "0.92rem" }}>
          Aradığınız sayfa arşivlenmiş, konumu değiştirilmiş ya da bu sayfayı görüntüleme izniniz bulunmuyor olabilir.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="button primary" href="/">
            Ana Sayfaya Dön
          </Link>
          <Link className="button" href="/giris">
            Giriş Yap
          </Link>
        </div>
      </div>
    </main>
  );
}

