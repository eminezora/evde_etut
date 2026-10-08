import Link from "next/link";
import { isResetTokenValid } from "@/lib/accounts/password-service.ts";
import { AuthShell } from "@/components/auth/AuthShell.tsx";
import { ResetPasswordForm } from "@/components/auth/PasswordForms.tsx";

export const metadata = { title: "Şifre Sıfırla – DersBot" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = await isResetTokenValid(token);
  return (
    <AuthShell
      icon="✎"
      title="Yeni Şifre Belirle"
      subtitle={valid ? "Hesabınız için yeni bir şifre belirleyin." : undefined}
      footer={<Link href="/giris" style={{ fontWeight: 600 }}>← Giriş sayfasına dön</Link>}
    >
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p className="error" role="alert">Şifre sıfırlama bağlantısı geçersiz, kullanılmış veya süresi dolmuş.</p>
          <Link href="/sifremi-unuttum" className="button primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
            Yeni bağlantı iste
          </Link>
        </>
      )}
    </AuthShell>
  );
}
