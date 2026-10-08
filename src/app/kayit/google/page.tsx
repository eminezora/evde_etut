import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readFlowToken } from "@/lib/auth/session.ts";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { AuthShell } from "@/components/auth/AuthShell.tsx";
import { GoogleRoleForm } from "@/components/auth/PasswordForms.tsx";

export const metadata = { title: "Hesabını Tamamla – Evde Etüt" };

export default async function GoogleSignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/ogretmen/gorevler" : "/ogrenci/gorevler");
  const identity = await readFlowToken<{ name: string; email: string }>("google-signup", (await cookies()).get("g_signup")?.value);
  if (!identity) redirect("/giris?hata=google-hata");
  return (
    <AuthShell
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      }
      title="Hesabını Tamamla"
      subtitle={`${identity.name} (${identity.email}) olarak Google ile devam ediyorsunuz. Evde Etüt'ü nasıl kullanacaksınız?`}
      width={480}
      footer={<Link href="/giris">Vazgeç</Link>}
    >
      <GoogleRoleForm />
    </AuthShell>
  );
}
