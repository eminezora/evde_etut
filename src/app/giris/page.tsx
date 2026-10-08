import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { LoginForm } from "@/components/LoginForm.tsx";
import { AuthShell, GOOGLE_ERRORS, GoogleButton } from "@/components/auth/AuthShell.tsx";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ hata?: string; sifre?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/ogretmen/gorevler" : "/ogrenci/gorevler");
  const { hata, sifre } = await searchParams;

  return (
    <AuthShell
      icon="✎"
      title="Giriş Yap"
      subtitle="DersBot hesabınıza erişerek derse hazırlık görevlerinizi takip edin."
      footer={
        <>
          <span className="muted">Hesabınız yok mu? </span>
          <Link href="/kayit" style={{ fontWeight: 600 }}>Ücretsiz kayıt olun →</Link>
        </>
      }
    >
      {sifre === "yenilendi" && <p className="notice-inline ok" role="status">Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.</p>}
      {hata && GOOGLE_ERRORS[hata] && <p className="error" role="alert">{GOOGLE_ERRORS[hata]}</p>}
      <GoogleButton />
      <LoginForm />
    </AuthShell>
  );
}
