import { redirect } from "next/navigation";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { RegisterForm } from "@/components/RegisterForm.tsx";

export default async function RegisterPage() {
  if (await getCurrentTeacher()) redirect("/ogretmen/gorevler");
  if (await getCurrentStudent()) redirect("/ogrenci/gorevler");
  return (
    <main>
      <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h1>Kayıt ol</h1>
        <RegisterForm />
      </div>
    </main>
  );
}
