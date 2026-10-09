import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/current-user.ts";
import { getStudentProfile } from "@/lib/accounts/profile-service.ts";
import { ProfileHeader } from "@/components/profile/ProfileHeader.tsx";
import { NameForm, PasswordForm } from "@/components/profile/ProfileForms.tsx";
import { JoinClassroomForm } from "@/components/student/JoinClassroomForm.tsx";
import { LogoutButton } from "@/components/LogoutButton.tsx";
import { UsagePanel } from "@/components/usage/UsagePanel.tsx";

export const metadata = { title: "Profil – DersBot" };

export default async function StudentProfilePage() {
  const student = await requireStudent();
  const p = await getStudentProfile(student.id);
  if (!p) notFound();
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div className="editorial-kicker">ÖĞRENCİ DOSYASI & HESAP YÖNETİMİ</div>
        <h1 style={{ margin: "4px 0 6px", fontSize: "1.75rem", fontFamily: "var(--font-serif)" }}>
          Öğrenci Profili ve Ayarları
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Hesap bilgilerinizi, güvenlik tercihlerinizi ve katıldığınız sınıfları yönetin.
        </p>
      </div>

      <ProfileHeader user={p.user} />

      {/* Editorial Metrics Strip */}
      <div className="editorial-metrics" style={{ margin: "20px 0" }}>
        <div className="metric">
          <span className="metric-label">Toplam Görev</span>
          <div className="metric-value">{p.stats.total}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Atanan hazırlık görevi</span>
        </div>
        <div className="metric">
          <span className="metric-label">Tamamlanan</span>
          <div className="metric-value">{p.stats.completed}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Çözülen çalışmalar</span>
        </div>
        <div className="metric">
          <span className="metric-label">Derse Hazır</span>
          <div className="metric-value" style={{ color: "var(--leaf)" }}>{p.stats.ready}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Başarıyla tamamlanan</span>
        </div>
        <div className="metric">
          <span className="metric-label">İncelemede</span>
          <div className="metric-value" style={{ color: "var(--accent)" }}>{p.stats.pending}</div>
          <span className="muted" style={{ fontSize: "0.78rem" }}>Öğretmen onayı bekleyen</span>
        </div>
      </div>

      <UsagePanel user={{ id: student.id, role: "STUDENT" }} />

      {/* Section 01: Hesap */}
      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <div className="editorial-kicker" style={{ color: "var(--accent)" }}>BÖLÜM 01</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-serif)" }}>Hesap Bilgileri</h2>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <NameForm initialName={p.user.name} />

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <label style={{ margin: "0 0 4px", display: "block" }}>Kayıtlı E-posta Adresi</label>
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{p.user.email}</span>
              <span className="badge">Doğrulanmış Öğrenci Hesabı</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
              E-posta adresi güvenlik ve veli/öğretmen iletişimi nedeniyle buradan değiştirilemez.
            </p>
          </div>
        </div>
      </div>

      {/* Section 02: Güvenlik */}
      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <div className="editorial-kicker" style={{ color: "var(--accent)" }}>BÖLÜM 02</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-serif)" }}>Güvenlik ve Parola</h2>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          {!p.user.hasPassword && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--accent)",
                borderRadius: "var(--radius-xs)",
                marginBottom: 16,
                fontSize: "0.9rem",
              }}
            >
              Hesabınız Google ile oluşturuldu. İsterseniz e-posta ve şifrenizle doğrudan giriş yapabilmek için parola oluşturabilirsiniz.
            </div>
          )}
          <PasswordForm hasPassword={p.user.hasPassword} />
        </div>
      </div>

      {/* Section 03: Bağlı Sınıflar */}
      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <div className="editorial-kicker" style={{ color: "var(--accent)" }}>BÖLÜM 03</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-serif)" }}>Kayıtlı Sınıflarım</h2>
          </div>
          <span className="badge" style={{ background: "var(--surface-subtle)" }}>
            {p.classrooms.length} Sınıfa Kayıtlı
          </span>
        </div>
        <div style={{ padding: "20px" }}>
          {p.classrooms.length === 0 ? (
            <p className="muted" style={{ margin: "0 0 16px" }}>
              Henüz bir sınıfa katılmadınız. Öğretmeninizin paylaştığı 6 haneli katılım kodunu girerek sınıfınıza dahil olun.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {p.classrooms.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--surface-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>{c.name}</strong>
                    <span className="muted" style={{ fontSize: "0.85rem", marginLeft: 8 }}>({c.grade}. Sınıf)</span>
                  </div>
                  <span className="badge" style={{ background: "#ffffff" }}>
                    Öğretmen: {c.teacher.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "0.92rem", margin: "0 0 8px", color: "var(--ink)" }}>Yeni Sınıf Kodunu Girin</h3>
            <JoinClassroomForm />
          </div>
        </div>
      </div>

      {/* Section 04: Google */}
      <div className="editorial-panel" style={{ marginBottom: 20 }}>
        <div className="editorial-panel-header">
          <div>
            <div className="editorial-kicker" style={{ color: "var(--accent)" }}>BÖLÜM 04</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-serif)" }}>Google Kimlik Doğrulama</h2>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {p.user.googleLinked ? "Google ile Oturum Açma Aktif" : "Google Hesabı Bağlı Değil"}
              </p>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                {p.user.googleLinked
                  ? "Google Workspace veya kişisel Google hesabınızla tek tıkla güvenli giriş yapabilirsiniz."
                  : "Hesabınıza henüz bir Google kimliği bağlanmadı."}
              </p>
            </div>
            <span className="badge" style={p.user.googleLinked ? { background: "var(--leaf-light)", color: "var(--leaf)" } : {}}>
              {p.user.googleLinked ? "✓ Bağlandı" : "Bağlı Değil"}
            </span>
          </div>
        </div>
      </div>

      {/* Section 05: Oturum */}
      <div className="editorial-panel">
        <div className="editorial-panel-header">
          <div>
            <div className="editorial-kicker" style={{ color: "var(--crimson)" }}>BÖLÜM 05</div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontFamily: "var(--font-serif)" }}>Oturum ve Güvenlik</h2>
          </div>
        </div>
        <div style={{ padding: "20px" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>Bu Cihazdaki Açık Oturumu Kapat</p>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                Ortak veya okul bilgisayarlarında çalışmanız bittiğinde oturumunuzu kapatmayı unutmayın.
              </p>
            </div>
            <LogoutButton label="Güvenli Çıkış Yap" />
          </div>
        </div>
      </div>
    </>
  );
}
