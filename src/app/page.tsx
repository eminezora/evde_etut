import Link from "next/link";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";
import { DersBotLogo } from "@/components/brand/DersBotLogo.tsx";

export default async function HomePage() {
  const teacher = await getCurrentTeacher();
  const student = await getCurrentStudent();
  const user = teacher
    ? { role: "TEACHER" as const, name: teacher.name, href: "/ogretmen/gorevler" }
    : student
    ? { role: "STUDENT" as const, name: student.name, href: "/ogrenci/gorevler" }
    : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Editorial Masthead Top Header */}
      <header className="top" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DersBotLogo showSubtitle />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>
            Akıllı Derse Hazırlık Robotu
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="#pedagoji" style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>Pedagojik Model</a>
          <a href="#mufredat" style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>MEB Müfredatı</a>
          <a href="#is-akisi" style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>İş Akışı</a>
          {user ? (
            <div className="row" style={{ gap: 8, marginLeft: 8 }}>
              <span className="user-pill">
                <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name}</span>
              </span>
              <Link href={user.href} className="button primary" style={{ minHeight: 34, padding: "4px 14px", fontSize: "0.88rem" }}>
                Panelime Dön →
              </Link>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, marginLeft: 8 }}>
              <Link href="/giris" className="button ghost" style={{ minHeight: 34, padding: "4px 12px", fontSize: "0.88rem" }}>
                Giriş Yap
              </Link>
              <Link href="/kayit" className="button primary" style={{ minHeight: 34, padding: "4px 14px", fontSize: "0.88rem" }}>
                Kayıt Ol
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Editorial Lead Section (Two Columns: Manifesto & Worksheet Preview) */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 36px", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span className="badge" style={{ backgroundColor: "var(--surface-subtle)", color: "var(--accent)", borderColor: "var(--border-strong)" }}>
            T.C. Millî Eğitim Bakanlığı Türkiye Yüzyılı Maarif Modeli
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Ortaokul Kademeleri (5, 6, 7, 8. Sınıf)</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 40, alignItems: "start" }}>
          {/* Sol Sütun: Editoryal Manifesto */}
          <div>
            <h1 style={{ fontSize: "2.75rem", lineHeight: 1.15, marginBottom: 16 }}>
              DersBot ile Derse Eksiksiz ve Özgüvenle Hazırlanın.
            </h1>
            <p style={{ fontSize: "1.12rem", lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 24 }}>
              DersBot; geleneksel uzun ev ödevi yorgunluğunu ortadan kaldırarak ortaokul öğrencilerinin
              dersten önceki akşam yalnızca 5 dakikalık MEB kazanım özetini okumasını, formatif ön kontrolleri
              tamamlamasını ve öğretmenlerin ertesi sabah sınıfa hazır bulunuşluk analiziyle girmesini sağlayan
              akıllı eğitim robotudur.
            </p>

            <div className="row" style={{ gap: 12, marginBottom: 32 }}>
              <Link href="/kayit" className="button primary" style={{ padding: "10px 20px" }}>
                Öğrenci Olarak Başla →
              </Link>
              <Link href="/giris" className="button" style={{ padding: "10px 20px" }}>
                Öğretmen Girişi
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div>
                <strong style={{ display: "block", fontSize: "1.3rem", fontFamily: "var(--font-serif)" }}>5 Dakika</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Ders öncesi odaklı okuma süresi</span>
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "1.3rem", fontFamily: "var(--font-serif)" }}>%100 MEB</strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Resmi öğrenme çıktılarıyla birebir eşli</span>
              </div>
            </div>
          </div>

          {/* Sağ Sütun: Canlı Çalışma Kağıdı Görünümü (Editorial Worksheet) */}
          <div style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "24px 26px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <span className="kicker" style={{ margin: 0, fontSize: "0.72rem" }}>FEN BİLİMLERİ · 6. SINIF</span>
                <strong style={{ fontSize: "1rem" }}>Hücre ve Organelleri</strong>
              </div>
              <span className="badge READY">Derse Hazır (%96)</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                MEB Öğrenme Çıktısı
              </div>
              <p style={{ fontSize: "0.88rem", margin: 0, padding: "8px 10px", background: "var(--surface-subtle)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
                <span className="code" style={{ marginRight: 6 }}>FB.6.2.1</span>
                Bitki ve hayvan hücresinin temel organellerini görevleriyle açıklar.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                Temel Ders Notu (Özet)
              </div>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0, color: "var(--text-secondary)" }}>
                Hücre, canlıların yapı taşıdır. Hücre zarı madde alışverişini denetler. Kloroplast yalnızca bitki hücrelerinde bulunur ve fotosentez yapar; sentriyoller ise hayvan hücrelerinin bölünmesinde görev alır.
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Ön Bilgi Kontrolü (6 Soru)</span>
                <span style={{ color: "var(--ok)", fontWeight: 700 }}>✓ Tamamlandı</span>
              </div>
              <div className="progress">
                <span style={{ width: "96%" }} />
              </div>
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--muted)" }}>
                Öğretmenin değerlendirme ekranına aktarıldı.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial Principles 4-Column Strip */}
      <section id="pedagoji" style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 40px", width: "1080px" }}>
        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "28px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 24 }}>
            <div>
              <span className="kicker">01 / Odaklı Hazırlık</span>
              <h3 style={{ margin: "4px 0 8px" }}>5 Dakikalık Özet</h3>
              <p style={{ fontSize: "0.88rem", margin: 0, color: "var(--text-secondary)" }}>
                Öğrenci dersten önce ağır ders kitaplarında boğulmaz; yalnızca derse katılım için gereken anahtar kavramları okur.
              </p>
            </div>

            <div>
              <span className="kicker">02 / Resmi Müfredat</span>
              <h3 style={{ margin: "4px 0 8px" }}>Maarif Modeli Uyumu</h3>
              <p style={{ fontSize: "0.88rem", margin: 0, color: "var(--text-secondary)" }}>
                Platformdaki tüm dersler MEB programındaki resmi kodlarla kurgulanır; müfredat dışı hiçbir içerik üretilmez.
              </p>
            </div>

            <div>
              <span className="kicker">03 / Ön Değerlendirme</span>
              <h3 style={{ margin: "4px 0 8px" }}>Formatif Mini Kontrol</h3>
              <p style={{ fontSize: "0.88rem", margin: 0, color: "var(--text-secondary)" }}>
                Çoktan seçmeli, kavram eşleştirme ve açık uçlu sorularla öğrencinin konuyu anlama derecesi tespit edilir.
              </p>
            </div>

            <div>
              <span className="kicker">04 / Öğretmen Analizi</span>
              <h3 style={{ margin: "4px 0 8px" }}>Hazırlık Raporu</h3>
              <p style={{ fontSize: "0.88rem", margin: 0, color: "var(--text-secondary)" }}>
                Öğretmen sınıfa adım atmadan önce hangi öğrencilerin hazır olduğunu ve en çok hangi soruda takıldığını görür.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three Step Workflow */}
      <section id="is-akisi" style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 48px", width: "100%" }}>
        <span className="kicker">SİSTEMATİK AKIŞ</span>
        <h2 style={{ fontSize: "1.8rem", marginBottom: 20 }}>3 Adımda Eksiksiz Ders Hazırlığı</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "20px", background: "var(--surface)" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>ADIM 01</span>
            <h3 style={{ margin: "6px 0 8px" }}>Öğretmen Görev Atar</h3>
            <p style={{ fontSize: "0.9rem", margin: 0, color: "var(--text-secondary)" }}>
              Sınıfını ve MEB öğrenme çıktısını seçer. Pedagojik AI desteğiyle hazırlanan ders notunu ve mini testi inceleyip onaylar.
            </p>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "20px", background: "var(--surface)" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>ADIM 02</span>
            <h3 style={{ margin: "6px 0 8px" }}>Öğrenci Evde İnceler</h3>
            <p style={{ fontSize: "0.9rem", margin: 0, color: "var(--text-secondary)" }}>
              Özet notu okur, 5 soruluk ön kontrolü çözer. Eksik kaldığı noktayı anında görerek derse hazır hale gelir.
            </p>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "20px", background: "var(--surface)" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>ADIM 03</span>
            <h3 style={{ margin: "6px 0 8px" }}>Sınıf Derste Buluşur</h3>
            <p style={{ fontSize: "0.9rem", margin: 0, color: "var(--text-secondary)" }}>
              Öğretmen hazırlık durumunu bilerek dersi başlatır; öğrenciler ön bilgileri sağlam olduğu için özgüvenle katılır.
            </p>
          </div>
        </div>
      </section>

      {/* Curriculum Matrix Section */}
      <section id="mufredat" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 64px", width: "100%" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <span className="kicker">MÜFREDAT VERİ TABANI</span>
              <h2 style={{ margin: "4px 0 0" }}>Desteklenen Dersler ve Kademeler</h2>
            </div>
            <Link href="/kayit" className="button primary" style={{ minHeight: 34, fontSize: "0.85rem" }}>
              Hemen Başla →
            </Link>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ders</th>
                  <th>Kademeler</th>
                  <th>Öğrenme Alanları</th>
                  <th>Müfredat Uyumu</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Türkçe</strong></td>
                  <td>5, 6, 7, 8. Sınıf</td>
                  <td>Okuma, Yazma, Dinleme, Dil Yapıları</td>
                  <td><span className="badge READY">MEB 2026 Maarif Modeli</span></td>
                </tr>
                <tr>
                  <td><strong>Matematik</strong></td>
                  <td>5, 6, 7, 8. Sınıf</td>
                  <td>Sayılar, Cebir, Geometri ve Ölçme, Veri</td>
                  <td><span className="badge READY">MEB 2026 Maarif Modeli</span></td>
                </tr>
                <tr>
                  <td><strong>Fen Bilimleri</strong></td>
                  <td>5, 6, 7, 8. Sınıf</td>
                  <td>Canlılar ve Yaşam, Madde, Fiziksel Olaylar</td>
                  <td><span className="badge READY">MEB 2026 Maarif Modeli</span></td>
                </tr>
                <tr>
                  <td><strong>Sosyal Bilgiler</strong></td>
                  <td>5, 6, 7. Sınıf / T.C. İnkılap Tarihi (8)</td>
                  <td>Birey ve Toplum, Kültür, Zaman ve Süreklilik</td>
                  <td><span className="badge READY">MEB 2026 Maarif Modeli</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Editorial Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "28px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <DersBotLogo size="sm" />
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>· Millî Eğitim Bakanlığı Standartlarında Derse Hazırlık Robotu</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            © 2026 DersBot. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </div>
  );
}
