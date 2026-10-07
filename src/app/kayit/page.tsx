import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { RegisterForm } from "@/components/RegisterForm.tsx";

export default async function RegisterPage() {
  if (await getCurrentTeacher()) redirect("/ogretmen/gorevler");
  if (await getCurrentStudent()) redirect("/ogrenci/gorevler");

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

      <main style={{ maxWidth: 480, margin: "auto", width: "100%", padding: "20px 16px 60px" }}>
        <div className="card" style={{ padding: "32px 28px", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span className="brand-icon" style={{ width: 44, height: 44, fontSize: "1.4rem", margin: "0 auto 12px" }}>
              ✨
            </span>
            <h1 style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>Hesap Oluştur</h1>
            <p className="muted" style={{ fontSize: "0.92rem", margin: 0 }}>
              Öğrenci veya öğretmen olarak hemen Evde Etüt ailesine katılın.
            </p>
          </div>

          <RegisterForm />

          <div style={{ textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", fontSize: "0.92rem" }}>
            <span className="muted">Zaten hesabınız var mı? </span>
            <Link href="/giris" style={{ fontWeight: 600 }}>
              Giriş yapın →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
