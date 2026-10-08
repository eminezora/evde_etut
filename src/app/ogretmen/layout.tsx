import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";
import { DersBotLogo } from "@/components/brand/DersBotLogo.tsx";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/giris");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg)" }}>
      {/* Top Editorial Header (Mobile & Desktop Global Header) */}
      <header className="top">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <DersBotLogo href="/ogretmen/gorevler" />
          <span className="badge" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--accent)", borderColor: "var(--border)" }}>
            Öğretmen Çalışma Alanı
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/ogretmen/gorevler/yeni"
            className="button primary"
            style={{ minHeight: 32, padding: "4px 12px", fontSize: "0.85rem" }}
          >
            + Yeni Görev
          </Link>

          <Link href="/ogretmen/profil" className="user-pill" title="Profil ve hesap ayarları">
            <span className="user-avatar">{teacher.name.charAt(0).toUpperCase()}</span>
            <span>{teacher.name}</span>
          </Link>
          <LogoutButton />
        </div>
      </header>

      {/* Two Column Workspace: Compact Left Rail + Main Work Area */}
      <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 58px)" }}>
        {/* Left Sidebar / Rail */}
        <aside className="editorial-sidebar">
          <div style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>ÖĞRETMEN PORTALI</span>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
              {teacher.name}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
              {teacher.email}
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link href="/ogretmen/gorevler" className="sidebar-link">
              <span style={{ fontSize: "1rem" }}>⊞</span>
              <span>Genel Bakış</span>
            </Link>
            <Link href="/ogretmen/siniflar" className="sidebar-link">
              <span style={{ fontSize: "1rem" }}>⌂</span>
              <span>Sınıflarım</span>
            </Link>
            <Link href="/ogretmen/gorevler" className="sidebar-link">
              <span style={{ fontSize: "1rem" }}>≡</span>
              <span>Görevler</span>
            </Link>
            <Link href="/ogretmen/degerlendirme" className="sidebar-link">
              <span style={{ fontSize: "1rem" }}>✓</span>
              <span>Değerlendirme</span>
            </Link>
            <Link href="/ogretmen/profil" className="sidebar-link">
              <span style={{ fontSize: "1rem" }}>○</span>
              <span>Profil</span>
            </Link>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <Link
                href="/ogretmen/gorevler/yeni"
                className="button primary"
                style={{ width: "100%", justifyContent: "center", minHeight: 36, fontSize: "0.88rem" }}
              >
                + Yeni Görev Oluştur
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Work Area */}
        <div style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          <main style={{ maxWidth: 1040, padding: "28px 24px 80px" }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
