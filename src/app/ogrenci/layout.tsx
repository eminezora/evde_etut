import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await getCurrentStudent();
  if (!student) redirect("/giris");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="top">
        <div className="row" style={{ gap: 12 }}>
          <Link href="/ogrenci/gorevler" className="brand-badge">
            <span className="brand-icon">📚</span>
            <span>Evde Etüt</span>
          </Link>
          <span className="badge" style={{ background: "var(--ok-bg)", color: "var(--ok-text)", borderColor: "var(--ok-border)" }}>
            🎓 Öğrenci
          </span>
        </div>
        <nav>
          <Link href="/ogrenci/gorevler">Görevlerim</Link>
          <Link href="/ogrenci/profil">Profil</Link>
          <div className="row" style={{ gap: 8, marginLeft: 6 }}>
            <Link href="/ogrenci/profil" className="user-pill" title="Profil ve hesap ayarları">
              <span className="user-avatar" style={{ background: "var(--ok)" }}>{student.name.charAt(0).toUpperCase()}</span>
              <span>{student.name}</span>
            </Link>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
