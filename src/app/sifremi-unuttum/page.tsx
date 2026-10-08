import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell.tsx";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms.tsx";

export const metadata = { title: "Şifremi Unuttum – Evde Etüt" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3" />
        </svg>
      }
      title="Şifremi Unuttum"
      subtitle="Hesabınızın e-posta adresini yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim."
      footer={<Link href="/giris" style={{ fontWeight: 600 }}>← Giriş sayfasına dön</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
