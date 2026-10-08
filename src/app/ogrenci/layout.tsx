import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await getCurrentStudent();
  if (!student) redirect("/giris");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg)" }}>
      {/* Editorial Student Top Header */}
      <header className="top">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/ogrenci/gorevler" className="brand-badge">
            <span className="brand-icon">✎</span>
            <span>Evde Etüt</span>
          </Link>
          <span className="badge" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
            Öğrenci Çalışma Alanı
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/ogrenci/gorevler" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Ana Sayfa
          </Link>
          <Link href="/ogrenci/gorevler#gorevler" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Görevlerim
          </Link>
          <Link href="/ogrenci/gorevler#siniflarim" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Sınıflarım
          </Link>
          <Link href="/ogrenci/gorevler#gecmis" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Geçmişim
          </Link>
          <Link href="/ogrenci/profil" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
            Profil
          </Link>

          <div className="row" style={{ gap: 8, marginLeft: 12 }}>
            <Link href="/ogrenci/profil" className="user-pill" title="Profil ve hesap ayarları">
              <span className="user-avatar" style={{ backgroundColor: "var(--accent)" }}>
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span>{student.name}</span>
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: 1040, padding: "32px 24px 80px" }}>
        {children}
      </main>
    </div>
  );
}
