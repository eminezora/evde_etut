import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { LoginForm } from "@/components/LoginForm.tsx";

export default async function LoginPage() {
  if (await getCurrentTeacher()) redirect("/ogretmen/gorevler");
  if (await getCurrentStudent()) redirect("/ogrenci/gorevler");
  return (
    <main>
      <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
        <h1>Giriş</h1>
        <LoginForm />
        <p style={{ marginTop: 16 }}><Link href="/kayit">Hesabın yok mu? Kayıt ol</Link></p>
      </div>
    </main>
  );
}
