import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { getTeacherProfile } from "@/lib/accounts/profile-service.ts";
import { ProfileHeader } from "@/components/profile/ProfileHeader.tsx";
import { NameForm, PasswordForm } from "@/components/profile/ProfileForms.tsx";
import { LogoutButton } from "@/components/LogoutButton.tsx";

export const metadata = { title: "Profil & Hesap – Evde Etüt" };

export default async function TeacherProfilePage() {
  const teacher = await requireTeacher();
  const p = await getTeacherProfile(teacher.id);
  if (!p) notFound();

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <span className="kicker">ÖĞRETMEN HESAP YÖNETİMİ</span>
        <h1 style={{ margin: "2px 0 6px" }}>Profil ve Güvenlik Ayarları</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
          Kişisel bilgilerinizi, şifrenizi ve bağlı sınıflarınızın operasyonel durumunu yönetin.
        </p>
      </div>

      <ProfileHeader user={p.user} />

      {/* Section: Editorial Metrics Strip */}
      <div className="editorial-metrics" style={{ marginBottom: 24 }}>
        <div className="metric-item">
          <div className="metric-value">{p.stats.classrooms}</div>
          <div className="metric-label">Aktif Sınıf</div>
          <div className="metric-desc">Yönettiğiniz toplam şube</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">{p.stats.students}</div>
          <div className="metric-label">Kayıtlı Öğrenci</div>
          <div className="metric-desc">Sınıflarınızdaki öğrenciler</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--ok)" }}>{p.stats.activeAssignments}</div>
          <div className="metric-label">Yayındaki Görev</div>
          <div className="metric-desc">Öğrencilerin eriştiği görevler</div>
        </div>
        <div className="metric-item">
          <div className="metric-value" style={{ color: "var(--warn)" }}>{p.stats.draftAssignments}</div>
          <div className="metric-label">Taslak Görev</div>
          <div className="metric-desc">Hazırlık aşamasındaki ödevler</div>
        </div>
      </div>

      {/* Section 1: Hesap Bilgileri */}
      <div className="editorial-panel">
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
          <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BÖLÜM 01</span>
          <h2 style={{ fontSize: "1.2rem", margin: "2px 0 0" }}>Hesap Bilgileri</h2>
        </div>

        <NameForm initialName={p.user.name} />

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
          <label style={{ margin: "0 0 4px" }}>Kayıtlı E-posta Adresi</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{p.user.email}</span>
            <span className="badge">Doğrulanmış Hesap</span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
            E-posta adresi güvenlik ve veri bütünlüğü nedeniyle doğrudan değiştirilemez.
          </p>
        </div>
      </div>

      {/* Section 2: Güvenlik & Şifre */}
      <div className="editorial-panel">
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
          <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BÖLÜM 02</span>
          <h2 style={{ fontSize: "1.2rem", margin: "2px 0 0" }}>Güvenlik ve Parola</h2>
        </div>

        {!p.user.hasPassword && (
          <p className="info" style={{ marginTop: 0, marginBottom: 16 }}>
            Hesabınız Google ile açıldı. Dilerseniz e-posta ve şifreyle de oturum açabilmek için aşağıdan parola belirleyebilirsiniz.
          </p>
        )}
        <PasswordForm hasPassword={p.user.hasPassword} />
      </div>

      {/* Section 3: Bağlı Sınıflar */}
      <div className="editorial-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 16 }}>
          <div>
            <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BÖLÜM 03</span>
            <h2 style={{ fontSize: "1.2rem", margin: "2px 0 0" }}>Bağlı Sınıflar ve Şubeler</h2>
          </div>
          <Link href="/ogretmen/siniflar" className="button" style={{ minHeight: 28, fontSize: "0.8rem", padding: "2px 10px" }}>
            Tüm Sınıfları Yönet →
          </Link>
        </div>

        {p.classrooms.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Henüz sınıf oluşturmadınız. <Link href="/ogretmen/siniflar">İlk sınıfınızı oluşturun.</Link>
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sınıf / Şube</th>
                  <th>Düzey</th>
                  <th>Katılım Kodu</th>
                  <th>Kayıtlı Öğrenci</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {p.classrooms.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`} style={{ fontWeight: 600 }}>
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.grade}. sınıf</td>
                    <td><span className="code">{c.joinCode}</span></td>
                    <td>{c._count.members} öğrenci</td>
                    <td>
                      <Link href={`/ogretmen/siniflar/${c.id}`} style={{ fontSize: "0.82rem" }}>
                        Yönet →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Google Bağlantısı */}
      <div className="editorial-panel">
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 14 }}>
          <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BÖLÜM 04</span>
          <h2 style={{ fontSize: "1.2rem", margin: "2px 0 0" }}>Google Entegrasyonu</h2>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <strong style={{ fontSize: "0.95rem" }}>Google Hesabı ile Oturum Açma</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
              {p.user.hasPassword ? "Google veya e-posta/şifre ile dilediğiniz gibi giriş yapabilirsiniz." : "Oturum açma Google OAuth ile eşleştirilmiştir."}
            </p>
          </div>
          <span className="badge READY">Aktif</span>
        </div>
      </div>

      {/* Section 5: Oturum Yönetimi */}
      <div className="editorial-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>BÖLÜM 05</span>
          <strong style={{ display: "block", fontSize: "0.95rem" }}>Aktif Cihaz Oturumu</strong>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Bu tarayıcıdaki öğretmen oturumunuzu güvenle sonlandırın.
          </span>
        </div>
        <LogoutButton label="Güvenli Çıkış Yap" />
      </div>
    </>
  );
}
