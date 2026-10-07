import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const student = await getCurrentStudent();
  if (!student) redirect("/giris");
  return (
    <>
      <header className="top">
        <strong>Ödev Takip</strong>
        <nav>
          <Link href="/ogrenci/gorevler">Görevlerim</Link>
          <span className="muted">{student.name}</span>
          <LogoutButton />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
