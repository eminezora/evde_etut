import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell.tsx";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms.tsx";

export const metadata = { title: "Şifremi Unuttum – Evde Etüt" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      icon="🔑"
      title="Şifremi Unuttum"
      subtitle="Hesabınızın e-posta adresini yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim."
      footer={<Link href="/giris" style={{ fontWeight: 600 }}>← Giriş sayfasına dön</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
