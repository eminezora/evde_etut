import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getTeacherProfile } from "@/lib/accounts/profile-service.ts";
import { ProfileHeader } from "@/components/profile/ProfileHeader.tsx";
import { NameForm, PasswordForm } from "@/components/profile/ProfileForms.tsx";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export const metadata = { title: "Profil – Evde Etüt" };

export default async function TeacherProfilePage() {
  const teacher = await requireTeacher();
  const p = await getTeacherProfile(teacher.id);
  if (!p) notFound();
  return (
    <>
      <ProfileHeader user={p.user} />

      <div className="card">
        <h2>Özet</h2>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat"><span className="muted">Sınıf</span><strong>{p.stats.classrooms}</strong></div>
          <div className="stat"><span className="muted">Öğrenci</span><strong>{p.stats.students}</strong></div>
          <div className="stat"><span className="muted">Aktif görev</span><strong>{p.stats.activeAssignments}</strong></div>
          <div className="stat"><span className="muted">Taslak görev</span><strong>{p.stats.draftAssignments}</strong></div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Sınıflarım</h2>
          <Link href="/ogretmen/siniflar">Sınıfları yönet →</Link>
        </div>
        {p.classrooms.length === 0 ? (
          <p className="muted">Henüz sınıf oluşturmadınız. <Link href="/ogretmen/siniflar">İlk sınıfınızı oluşturun.</Link></p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Sınıf</th><th>Düzey</th><th>Katılma kodu</th><th>Öğrenci</th></tr></thead>
              <tbody>
                {p.classrooms.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/ogretmen/siniflar/${c.id}`}>{c.name}</Link></td>
                    <td>{c.grade}. sınıf</td>
                    <td><span className="code">{c.joinCode}</span></td>
                    <td>{c._count.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Hesap Ayarları</h2>
        <NameForm initialName={p.user.name} />
        <label style={{ marginTop: 18 }}>E-posta</label>
        <p className="muted" style={{ margin: 0 }}>{p.user.email} · E-posta adresi güvenlik nedeniyle buradan değiştirilemez.</p>
        <h3 style={{ margin: "22px 0 8px", fontSize: "1rem" }}>{p.user.hasPassword ? "Şifre" : "Parola"}</h3>
        {!p.user.hasPassword && <p className="muted" style={{ margin: "0 0 10px" }}>Hesabınız Google ile oluşturuldu. İsterseniz e-posta ile de giriş yapabilmek için bir parola oluşturabilirsiniz.</p>}
        <PasswordForm hasPassword={p.user.hasPassword} />
      </div>

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <span className="muted">Bu cihazdaki oturumu kapatın.</span>
        <LogoutButton label="Çıkış Yap" />
      </div>
    </>
  );
}
