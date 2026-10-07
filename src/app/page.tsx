import { redirect } from "next/navigation";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";

export default async function Home() {
  if (await getCurrentTeacher()) redirect("/ogretmen/gorevler");
  if (await getCurrentStudent()) redirect("/ogrenci/gorevler");
  redirect("/giris");
}
