import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { RegisterForm } from "@/components/RegisterForm.tsx";
import { AuthShell, GoogleButton } from "@/components/auth/AuthShell.tsx";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/ogretmen/gorevler" : "/ogrenci/gorevler");

  return (
    <AuthShell
      icon="✎"
      title="Hesap Oluştur"
      subtitle="Öğrenci veya öğretmen olarak hemen DersBot ailesine katılın."
      width={480}
      footer={
        <>
          <span className="muted">Zaten hesabınız var mı? </span>
          <Link href="/giris" style={{ fontWeight: 600 }}>Giriş yapın →</Link>
        </>
      }
    >
      <GoogleButton />
      <RegisterForm />
    </AuthShell>
  );
}
