import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div className="card" style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "40px 32px" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>🔍</div>
        <span className="badge" style={{ marginBottom: 12 }}>Hata 404</span>
        <h1 style={{ fontSize: "1.75rem", margin: "8px 0 12px" }}>Sayfa Bulunamadı</h1>
        <p className="muted" style={{ lineHeight: 1.6, marginBottom: 24 }}>
          Aradığınız sayfa yayından kaldırılmış, adı değiştirilmiş ya da bu sayfayı görüntüleme yetkiniz bulunmuyor olabilir.
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

