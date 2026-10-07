import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/giris");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="top">
        <div className="row" style={{ gap: 12 }}>
          <Link href="/ogretmen/gorevler" className="brand-badge">
            <span className="brand-icon">📚</span>
            <span>Evde Etüt</span>
          </Link>
          <span className="badge" style={{ background: "var(--accent-light)", color: "var(--accent)", borderColor: "var(--accent-border)" }}>
            👨‍🏫 Öğretmen
          </span>
        </div>
        <nav>
          <Link href="/ogretmen/gorevler">Görevler</Link>
          <Link href="/ogretmen/siniflar">Sınıflarım</Link>
          <Link href="/ogretmen/degerlendirme">Değerlendirme</Link>
          <Link href="/ogretmen/profil">Profil</Link>
          <Link href="/ogretmen/gorevler/yeni" className="button primary" style={{ minHeight: 34, padding: "5px 12px", fontSize: "0.88rem" }}>
            + Yeni Görev
          </Link>
          <div className="row" style={{ gap: 8, marginLeft: 6 }}>
            <Link href="/ogretmen/profil" className="user-pill" title="Profil ve hesap ayarları">
              <span className="user-avatar">{teacher.name.charAt(0).toUpperCase()}</span>
              <span>{teacher.name}</span>
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
