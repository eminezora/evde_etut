import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentProfile } from "@/lib/accounts/profile-service.ts";
import { ProfileHeader } from "@/components/profile/ProfileHeader.tsx";
import { NameForm, PasswordForm } from "@/components/profile/ProfileForms.tsx";
import { JoinClassroomForm } from "@/components/student/JoinClassroomForm.tsx";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export const metadata = { title: "Profil – Evde Etüt" };

export default async function StudentProfilePage() {
  const student = await requireStudent();
  const p = await getStudentProfile(student.id);
  if (!p) notFound();
  return (
    <>
      <ProfileHeader user={p.user} />

      <div className="card">
        <h2>Çalışma Özetim</h2>
        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat"><span className="muted">Toplam görev</span><strong>{p.stats.total}</strong></div>
          <div className="stat"><span className="muted">Tamamlanan</span><strong>{p.stats.completed}</strong></div>
          <div className="stat"><span className="muted">Derse hazır</span><strong style={{ color: "var(--ok)" }}>{p.stats.ready}</strong></div>
          <div className="stat"><span className="muted">Bekleyen</span><strong style={{ color: "var(--accent)" }}>{p.stats.pending}</strong></div>
        </div>
      </div>

      <div className="card">
        <h2>Sınıflarım</h2>
        {p.classrooms.length === 0 ? (
          <p className="muted">Henüz bir sınıfa katılmadın. Öğretmeninden aldığın sınıf kodunu aşağıya yaz.</p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
            {p.classrooms.map((c) => (
              <li key={c.id}><strong>{c.name}</strong> ({c.grade}. sınıf) · {c.teacher.name}</li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <JoinClassroomForm />
        </div>
      </div>

      <div className="card">
        <h2>Hesap Ayarları</h2>
        <NameForm initialName={p.user.name} />
        <label style={{ marginTop: 18 }}>E-posta</label>
        <p className="muted" style={{ margin: 0 }}>{p.user.email} · E-posta adresi güvenlik nedeniyle buradan değiştirilemez.</p>
        <h3 style={{ margin: "22px 0 8px", fontSize: "1rem" }}>{p.user.hasPassword ? "Şifre" : "Parola"}</h3>
        {!p.user.hasPassword && <p className="muted" style={{ margin: "0 0 10px" }}>Hesabın Google ile oluşturuldu. İstersen e-posta ile de giriş yapabilmek için bir parola oluşturabilirsin.</p>}
        <PasswordForm hasPassword={p.user.hasPassword} />
      </div>

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <span className="muted">Bu cihazdaki oturumu kapat.</span>
        <LogoutButton label="Çıkış Yap" />
      </div>
    </>
  );
}
