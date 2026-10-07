"use client";

// Generic error screen: never shows the error message or stack trace to the user.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }} role="alert">
        <h1>Bir sorun oluştu</h1>
        <p>İşlem tamamlanamadı. Sayfayı yeniden deneyebilir ya da biraz sonra tekrar gelebilirsiniz.</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => reset()}>Tekrar dene</button>
          <a className="button" href="/">Ana sayfa</a>
        </div>
      </div>
    </main>
  );
}
