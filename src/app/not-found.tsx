import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <h1>Sayfa bulunamadı</h1>
        <p>Aradığınız sayfa yok ya da bu sayfayı görüntüleme yetkiniz bulunmuyor.</p>
        <Link className="button primary" href="/">Ana sayfaya dön</Link>
      </div>
    </main>
  );
}
