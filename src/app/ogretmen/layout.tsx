import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/giris");
  return (
    <>
      <header className="top">
        <strong>Ödev Takip</strong>
        <nav>
          <Link href="/ogretmen/siniflar">Sınıflarım</Link>
          <Link href="/ogretmen/gorevler">Görevler</Link>
          <Link href="/ogretmen/gorevler/yeni">Yeni görev</Link>
          <Link href="/ogretmen/degerlendirme">Değerlendirme</Link>
          <span className="muted">{teacher.name}</span>
          <LogoutButton />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
