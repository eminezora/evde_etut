# 5 Dakikalık Demo Akışı

Hazırlık (sunumdan önce): `npm run demo` (demo sınıfını sıfırlar), iki tarayıcı penceresi açın:
A = öğretmen, B = öğrenci (gizli pencere). Şifre: `DEMO_PASSWORD`. Yapay zekâ için `.env.local`'de EVREN ayarları tanımlı olmalı.

| Süre | Adım | Ne gösterilir / ne söylenir |
|---|---|---|
| 0:00 | **1. Problem** | "Öğrenciler yeni konuya ön bilgisiz geliyor; öğretmen kimin hazır olduğunu derse girmeden bilmiyor. Bu uygulama MEB Maarif Modeli öğrenme çıktılarına bağlı kısa bir hazırlık ve ön bilgi kontrolüyle bunu ölçer." |
| 0:30 | **2. Teacher login** | A: `ogretmen@demo.local` ile giriş → Sınıflarım: 5/A, katılma kodu **DEMO5A**. |
| 0:50 | **3. Assignment** | Görevler → taslak **"Kuvvet ve ölçülmesi"** görevini açın (zaman kazanmak için hazır taslak). İsterseniz Yeni görev sihirbazında sınıf → ders → tema adımlarını kısaca gösterin. |
| 1:20 | **4. MEB öğrenme çıktısı** | Genel sekmesi: `FB.5.2.1` – gerçek MEB çıktısı, "Kaynağı Görüntüle" tymm.meb.gov.tr'ye gider. Seçenekler veritabanındaki doğrulanmış müfredattan gelir. |
| 1:40 | **5. AI preparation content** | Hazırlık İçeriği → **Hazırlık İçeriği Oluştur** (EVREN, glm-5.3). Taslak gelirken: "Model yalnızca seçilen MEB çıktılarıyla sınırlı; çıktı doğrulanmadan kaydedilmez." Bir kavramı düzenleyin, bir soruyu sıralayın. (EVREN yanıt vermezse: içerik elle yazılabilir — manuel yedek akış.) |
| 2:40 | **6. Teacher approve** | **Onayla ve Yayınla**. "Öğretmen onayı olmadan hiçbir yapay zekâ içeriği öğrenciye görünmez." |
| 3:00 | **7. Student görevi tamamlar** | B: `ogrenci@demo.local` → Görevlerim → görev → Konu Özeti → "Özeti okudum…" → Ön Bilgi Kontrolü → soruları cevaplayın → Çalışmayı Bitir. |
| 3:50 | **8. READY_FOR_CLASS** | Sonuç: **"DERSE HAZIRSIN!"** — "Konuyu tamamen öğrendin demiyoruz; derse hazır temel ön bilgiyi oluşturdun diyoruz." |
| 4:10 | **9. Teacher analytics** | A: hazır demo görevi **"Güneş ve Ay"** → Analiz ve Hazırlık Raporu: hazırlık oranı, durum dağılımı, soru ve çıktı başarısı. |
| 4:40 | **10. Yarınki Derse Hazırlık Raporu** | Rapor kartı + ders başlangıç önerisi ("Özellikle FB.5.1.2 alanında zorlanma…"). Raporu Yazdır / CSV İndir'i gösterin. |
| 5:00 | Kapanış | "MEB'e bağlı, öğretmen onaylı, ölçülebilir ders öncesi hazırlık." |

Yedek senaryo: Değerlendirme sekmesinde bekleyen açık uçlu cevabı (Zeynep Demir) puanlayıp durumun nasıl kesinleştiğini gösterin.
