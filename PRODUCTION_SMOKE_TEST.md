# Production Smoke Test

Deploy sonrasında gerçek production adresinde, test için açılmış hesaplarla uygulayın.
Gerekenler: `TEACHER_SIGNUP_CODE`, iki farklı e-posta (öğretmen ve öğrenci), mümkünse iki ayrı tarayıcı/gizli pencere.

| # | Adım | Nasıl | Beklenen sonuç |
|---|---|---|---|
| 1 | Öğretmen kaydı/girişi | `/kayit` → "Öğretmen", ad, e-posta, şifre (≥8), davet kodu | Hesap oluşur, "Sınıflarım" sayfası açılır. Yanlış davet koduyla kayıt reddedilir. Çıkış → `/giris` ile tekrar giriş yapılabilir. |
| 2 | Sınıf oluşturma | Sınıflarım → ad "7/A", düzey 7 → Sınıf Oluştur | Sınıf listede 8 karakterlik **katılma kodu** ile görünür. |
| 3 | Öğrenci kaydı/girişi | Başka pencerede `/kayit` → "Öğrenci" | Hesap oluşur, "Görevlerim" panosu açılır; "Henüz bir sınıfa katılmadın." yazar. |
| 4 | Katılma koduyla sınıfa katılma | Pano → "Sınıfa katıl" → kodu girin (küçük harf/tire ile de olur) | "7/A sınıfına katıldın." mesajı; "Sınıflarım" satırında sınıf ve öğretmen adı görünür. Hatalı kod → "Bu koda ait bir sınıf bulunamadı." |
| 5 | Öğretmen görev oluşturma | Öğretmen → Yeni görev → 7/A seçin | Müfredat 7. sınıfla sınırlıdır; dersler veritabanından gelir (Türkçe, Matematik, Fen Bilimleri, İngilizce, Sosyal Bilgiler). |
| 6 | MEB öğrenme çıktısı seçme | Ders → Tema/Ünite → bir veya birkaç çıktı (ör. `MAT.7.1.1`) → konu, eşik %70, son tarih → "Taslak olarak kaydet" | Her çıktının altında "MEB Öğrenme Çıktısı / Kaynağı Görüntüle" kutusu çıkar (bağlantı tymm.meb.gov.tr'ye gider). Görev **Taslak** olarak oluşur, Hazırlık İçeriği sekmesi açılır. |
| 7 | İçerik hazırlama | AI açıksa "Hazırlık İçeriği Oluştur"; değilse "Yapay zekâ içerik üretimi şu anda yapılandırılmamış…" mesajı → içeriği elle yazıp kaydedin, "+ Yeni Soru Ekle" ile en az 1 soru (ör. çoktan seçmeli) | AI içeriği "Yapay zekâ taslağı – öğretmen onayı bekliyor" olarak gelir; manuel içerik "Manuel taslak". Sorular düzenlenebilir, silinebilir, sıralanabilir. |
| 8 | Öğretmen yayınlama | "Onayla ve Yayınla" | Görev durumu **Yayında**, içerik **Onaylandı**. İçerik/soru eksikken yayınlama gerekçeli olarak reddedilir. |
| 9 | Öğrenci görevi görme | Öğrenci panosu (yenileyin) | Görev "Yaklaşan Görevler"de ders, konu, sınıf, öğretmen ve son tarihle görünür. Taslak görevler görünmez. |
| 10 | Özeti okuma | Görev → "Konu Özetine Başla" → özet sonu: kutuyu işaretle → "Ön Bilgi Kontrolüne Geç" | Adımlar çubuğu ilerler; kutu işaretlenmeden buton pasiftir; durum "Ön bilgi kontrolüne hazır" olur. |
| 11 | Assessment çözme | "Ön Bilgi Kontrolünü Başlat" → soruları cevaplayın → sayfayı yenileyin → "Çalışmayı Bitir" | "1 / N soru" göstergesi; yenilemeden sonra cevaplar korunur (otomatik kayıt); gönderimden önce "Çalışmayı göndermek istediğine emin misin?" onayı ve cevaplanmamış soru uyarısı. |
| 12 | Puanlama | Gönderim sonrası Sonuç sayfası | Nesnel sorular sunucuda puanlanır; açık uçlu soru varsa "Öğretmen değerlendirmesi bekleniyor" mesajı çıkar ve geçici puan nihai gibi gösterilmez. Öğretmen → Değerlendirme → puan (0–max) + geri bildirim → kaydet. |
| 13 | READY_FOR_CLASS / NEEDS_REVIEW | Sonuç sayfası | Puan ≥ eşik: "DERSE HAZIRSIN!"; altında: "Biraz daha hazırlığa ihtiyacın var." + "Tekrar Bakmanı Öneriyoruz" + "Tekrar Çalış ve Yeniden Dene" (deneme sınırı dahilinde). Yeni deneme numarası 2 olur, eski deneme silinmez. |
| 14 | Öğretmen sonuçları görme | Görev → "Öğrenciler" sekmesi → öğrenci adına tıklayın | Atanan/özeti açan/derse hazır sayıları, ortalama puan, soru ve öğrenme çıktısı başarı oranları; öğrenci detayında tüm denemeler, cevaplar, son ve en iyi puan. |

Ek kontroller:
- Öğrenci, öğretmen URL'lerini (`/ogretmen/...`) açamaz; çıkış yapmış kullanıcı `/giris`'e yönlendirilir.
- Tarayıcı geliştirici araçlarında çalışma sayfasının kaynağında `correctAnswer` geçmez.
- Çerez `Secure` ve `HttpOnly` olarak gelir (Application → Cookies → `session`).
