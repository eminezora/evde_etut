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
  if (user) redirect(user.role === "TEACHER" ? "/ogretmen/gorevler" : "/ogrenci/gorevler");
  const identity = await readFlowToken<{ name: string; email: string }>("google-signup", (await cookies()).get("g_signup")?.value);
  if (!identity) redirect("/giris?hata=google-hata");
  return (
    <AuthShell
      icon="👋"
      title="Hesabını Tamamla"
      subtitle={`${identity.name} (${identity.email}) olarak Google ile devam ediyorsunuz. Evde Etüt'ü nasıl kullanacaksınız?`}
      width={480}
      footer={<Link href="/giris">Vazgeç</Link>}
    >
      <GoogleRoleForm />
    </AuthShell>
  );
}
