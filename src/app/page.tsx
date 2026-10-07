import Link from "next/link";
import { getCurrentStudent, getCurrentTeacher } from "@/lib/auth/current-user.ts";

export default async function HomePage() {
  const teacher = await getCurrentTeacher();
  const student = await getCurrentStudent();
  const user = teacher ? { role: "TEACHER" as const, name: teacher.name, href: "/ogretmen/gorevler" }
    : student ? { role: "STUDENT" as const, name: student.name, href: "/ogrenci/gorevler" }
    : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Public Topbar */}
      <header className="top">
        <Link href="/" className="brand-badge">
          <span className="brand-icon">📚</span>
          <span>Evde Etüt</span>
        </Link>
        <nav>
          <a href="#ozellikler">Özellikler</a>
          <a href="#mufredat">MEB Müfredatı</a>
          <a href="#nasil-calisir">Nasıl Çalışır?</a>
          {user ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="user-pill">
                <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name}</span>
              </span>
              <Link href={user.href} className="button primary" style={{ minHeight: 36, padding: "6px 14px" }}>
                Panelime Git →
              </Link>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <Link href="/giris" className="button" style={{ minHeight: 36, padding: "6px 14px" }}>
                Giriş Yap
              </Link>
              <Link href="/kayit" className="button primary" style={{ minHeight: 36, padding: "6px 14px" }}>
                Hemen Başla
              </Link>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-pill">
          <span>✨</span>
          <span>MEB Türkiye Yüzyılı Maarif Modeli ile %100 Uyumlu</span>
        </div>
        <h1>Derse Eksiksiz ve Özgüvenle Hazırlanın</h1>
        <p className="subtitle">
          Evde Etüt; ortaokul öğrencilerinin dersten önce MEB kazanımlarına uygun özetleri okumasını,
          yapay zekâ destekli ön bilgi kontrolünü tamamlamasını ve öğretmenlerin sınıfa hazır girmesini sağlayan
          yeni nesil eğitim platformudur.
        </p>
        <div className="landing-cta-row">
          <Link href="/kayit" className="button primary">
            Öğrenci Olarak Başla →
          </Link>
          <Link href="/giris" className="button">
            Öğretmen Girişi
          </Link>
        </div>

        {/* Live Visual Showcase Card */}
        <div className="card" style={{ maxWidth: 680, margin: "0 auto", textAlign: "left", border: "1px solid var(--accent-border)", background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-subtle) 100%)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge PUBLISHED">● Canlı Ön Hazırlık</span>
              <span className="muted" style={{ fontSize: "0.88rem" }}>5. Sınıf · Fen Bilimleri</span>
            </div>
            <span className="badge READY">Derse Hazır (%98)</span>
          </div>
          <h2 style={{ margin: "0 0 6px" }}>Güneş ve Ay: Temel Hareketler ve Özellikler</h2>
          <p className="muted" style={{ fontSize: "0.92rem", marginBottom: 12 }}>
            Kazanımlar: <span className="code" style={{ display: "inline" }}>FB.5.1.1</span> Güneş&apos;in yapısı · <span className="code" style={{ display: "inline" }}>FB.5.1.2</span> Ay&apos;ın yapısı ve hareketleri
          </p>
          <div className="progress" style={{ height: 10 }}>
            <span style={{ width: "98%" }} />
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12, fontSize: "0.88rem" }}>
            <span className="muted">5 dakikalık konu özeti tamamlandı · 6 soru çözüldü</span>
            <strong style={{ color: "var(--ok)" }}>✓ Yarınki derse hazır!</strong>
          </div>
        </div>
      </section>

      {/* Metrics Strip */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 20px", width: "100%" }}>
        <div className="stats-strip">
          <div className="stats-strip-item">
            <strong>5, 6, 7, 8</strong>
            <span>Tüm Ortaokul Kademeleri</span>
          </div>
          <div className="stats-strip-item">
            <strong>%100 MEB</strong>
            <span>Resmi Müfredat Çıktıları</span>
          </div>
          <div className="stats-strip-item">
            <strong>EVREN LLM</strong>
            <span>Kişiselleştirilmiş İçerik Üretimi</span>
          </div>
          <div className="stats-strip-item">
            <strong>Anlık Analiz</strong>
            <span>Yarınki Derse Hazırlık Raporu</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="ozellikler" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span className="badge">Neler Sunuyoruz?</span>
          <h2 style={{ fontSize: "2rem", marginTop: 8 }}>Etkili Öğrenme İçin Tasarlanmış Özellikler</h2>
          <p className="muted" style={{ maxWidth: 580, margin: "8px auto 0" }}>
            Geleneksel uzun ev ödevleri yerine derse odaklanan, kısa ve ölçülebilir ön hazırlık deneyimi.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-icon">📖</span>
            <h3>5 Dakikalık Akıllı Konu Özeti</h3>
            <p className="muted">
              Uzun ve karmaşık ders kitapları yerine, öğrencinin ertesi günkü dersi takip edebilmesi için
              gerekli temel kavramları ve &ldquo;Derse gelmeden önce bunları bilmen yeterli&rdquo; hap bilgilerini sunar.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🎯</span>
            <h3>5 Çeşit Ön Bilgi Kontrolü</h3>
            <p className="muted">
              Çoktan seçmeli, doğru-yanlış, boşluk doldurma, kavram eşleştirme, kronolojik sıralama ve
              açık uçlu sorularla öğrencinin ön bilgisini formatif olarak yoklar.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3>Yarınki Derse Hazırlık Raporu</h3>
            <p className="muted">
              Öğretmenler sınıfa girmeden önce hangi öğrencilerin derse hazır olduğunu, sınıfın en çok
              hangi kazanımda veya soruda takıldığını anlık grafiklerle görür.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Evren Yapay Zekâ Entegrasyonu</h3>
            <p className="muted">
              Öğretmen sadece sınıf ve MEB kazanımını seçer; EVREN LLM pedagojik normlara uygun özet ve
              soru taslağını saniyeler içinde hazırlar, öğretmen denetleyip yayınlar.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="nasil-calisir" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span className="badge">İş Akışı</span>
          <h2 style={{ fontSize: "2rem", marginTop: 8 }}>3 Adımda Eksiksiz Ders Hazırlığı</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div className="card" style={{ position: "relative" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--accent)", opacity: 0.25, position: "absolute", top: 16, right: 20 }}>01</span>
            <h3>1. Öğretmen Görev Atar</h3>
            <p className="muted">
              Sınıfını ve MEB öğrenme çıktısını seçer. Yapay zekâ taslağını onaylayıp tek tıkla öğrencilerine ulaştırır.
            </p>
          </div>
          <div className="card" style={{ position: "relative" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--accent)", opacity: 0.25, position: "absolute", top: 16, right: 20 }}>02</span>
            <h3>2. Öğrenci Evde Hazırlanır</h3>
            <p className="muted">
              Akşam 10 dakikasını ayırarak özeti okur, mini testini tamamlar. Eksiklerini anında görüp tekrar edebilir.
            </p>
          </div>
          <div className="card" style={{ position: "relative" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--accent)", opacity: 0.25, position: "absolute", top: 16, right: 20 }}>03</span>
            <h3>3. Sınıf Derse Hazır Buluşur</h3>
            <p className="muted">
              Öğretmen hazırlık raporunu inceleyerek derse başlar; öğrenci derste parmak kaldıracak özgüveni kazanır.
            </p>
          </div>
        </div>
      </section>

      {/* MEB Curriculum Banner */}
      <section id="mufredat" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px", width: "100%" }}>
        <div className="card" style={{ background: "var(--accent-gradient)", color: "#ffffff", padding: "40px 32px", borderRadius: "var(--radius-xl)" }}>
          <div style={{ maxWidth: 640 }}>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: 999, fontSize: "0.85rem", fontWeight: 600 }}>
              Resmi Müfredat Uyumlu
            </span>
            <h2 style={{ fontSize: "2.2rem", color: "#ffffff", margin: "16px 0 12px", lineHeight: 1.2 }}>
              MEB Öğrenme Çıktılarına Doğrudan Bağlı
            </h2>
            <p style={{ fontSize: "1.05rem", opacity: 0.9, lineHeight: 1.6, marginBottom: 24 }}>
              Türkçe, Matematik, Fen Bilimleri ve Sosyal Bilgiler programlarındaki her görev,
              resmi MEB kazanım kodlarıyla birebir eşleştirilmiştir. Öğretmenler ve öğrenciler asla müfredat dışına çıkmaz.
            </p>
            <div className="row" style={{ gap: 12 }}>
              <Link href="/kayit" className="button" style={{ background: "#ffffff", color: "#1e40af", borderColor: "transparent", fontWeight: 700 }}>
                Hemen Ücretsiz Katıl
              </Link>
              <Link href="/giris" className="button" style={{ background: "transparent", color: "#ffffff", borderColor: "rgba(255,255,255,0.4)" }}>
                Giriş Yap
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "32px 20px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="brand-icon" style={{ width: 28, height: 28, fontSize: "0.95rem" }}>📚</span>
            <strong>Evde Etüt Eğitim Platformu</strong>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            T.C. Millî Eğitim Bakanlığı müfredat standartlarıyla uyumlu akıllı derse hazırlık platformu.
          </p>
        </div>
      </footer>
    </div>
  );
}
