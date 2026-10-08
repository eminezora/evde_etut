# Evde Etüt – Sınıf Yönetimi, Maskot Chatbot ve Yönetim Paneli (Admin) Raporu

**Tarih:** 8 Ekim 2026  
**Proje:** `odev_claude`  
**Kapsam:** 
1. Sınıf Güncelleme, Silme ve Arşivleme Sistemi
2. Maskot "Etüt" İnteraktif Chatbot Dönüşümü
3. Yönetim Paneli (Admin Alanı), Öğretmen Davet Kodları ve Denetim (Audit) Sistemi

---

## 1. Admin Kimlik Doğrulama (Auth) Nasıl Çalışıyor?

- **Rol Tabanlı Erişim Denetimi (RBAC):**  
  `User` modelindeki `role` alanı artık `"STUDENT"`, `"TEACHER"` ve `"ADMIN"` rollerini destekler.
- **Güvenli JWT Oturumu:**  
  Kullanıcı kimliği ve rolü güvenli HTTP-Only çerezlerde saklanan JWT oturumu ile doğrulanır.
- **Sunucu Tarafı Güvenlik Katmanı:**  
  `src/lib/auth/current-user.ts` içinde:
  - `getCurrentAdmin()`: Mevcut kullanıcının geçerli ve aktif bir `ADMIN` olup olmadığını doğrular.
  - `requireAdmin()`: Admin değilse `403 Forbidden` veya `/giris` sayfasına yönlendirir.
- **API ve Sayfa Koruması:**  
  Tüm `/admin/*` sayfaları ve `/api/admin/*` endpoint'leri sunucu tarafında `requireAdmin()` koruması altındadır.
- **Yetkisiz Kayıt Engeli:**  
  `/kayit`, `/kayit/google`, `/api/auth/register` ve Google OAuth geri dönüş rotalarında `ADMIN` rolünün seçilmesi veya form/istek gövdesiyle manipüle edilmesi kesin olarak engellenmiştir.

---

## 2. İlk Admin Hesabı Nasıl Oluşturulur?

İlk admin hesabı güvenli CLI komutları ile oluşturulur veya mevcut bir hesap terfi ettirilir:

### A. Yeni Admin Hesabı Oluşturma
```bash
# İnteraktif mod (şifreyi gizleyerek sorar):
npm run admin:create

# Veya doğrudan parametrelerle:
npm run admin:create -- --email=admin@evdeetut.k12.tr --name="Sistem Yöneticisi" --password="GucluSifre123!"
```
*Not:* Canlı/uzak PostgreSQL veritabanında çalışırken kazara çalıştırmaları engellemek için `--allow-remote` bayrağı gereklidir:
```bash
npm run admin:create -- --allow-remote --email=admin@evdeetut.k12.tr --name="Sistem Yöneticisi"
```

### B. Mevcut Bir Kullanıcıyı Admin Yapma
```bash
npm run admin:promote -- --email=mevcut@kullanici.com
```

---

## 3. Öğretmen Davet Kodu (Teacher Invite Code) Sistemi Nasıl Değişti?

Eski statik ve tekil kod yapısından, veritabanı destekli, yönetilebilir ve izlenebilir bir davet kodu mimarisine geçilmiştir:

1. **Format:** Kriptografik rastgelelik içeren `OGRT-XXXX-XXXX` formatında (8 alfanümerik karakter) üretilir.
2. **Kullanım Limiti (`maxUses`):** Tek kullanımlık (`maxUses: 1`) veya çok kullanımlık (ör. 5, 20 veya sınırsız) olarak ayarlanabilir.
3. **Kullanım Sayacı (`usesCount`):** Her kullanımda atomik olarak artırılır.
4. **Geçerlilik Süresi (`expiresAt`):** Opsiyonel olarak son kullanım tarihi belirlenebilir (ör. 7 gün, 30 gün).
5. **Durum Yönetimi (`isActive`):** Admin dilediği anda kodu tek tıkla pasife alabilir (`ACTIVE` / `INACTIVE`).
6. **Kullanım Geçmişi (`TeacherInviteUsage`):** Hangi öğretmenin (`userId`) ne zaman (`usedAt`) hangi davet kodunu kullandığı veritabanında atomik transaction ile kaydedilir; yarış koşulları (race condition) engellenir.

---

## 4. `TEACHER_SIGNUP_CODE` Ortam Değişkeni (Env) Hâlâ Gerekiyor mu?

- **Zorunlu Değildir.**
- **Geriye Dönük Uyumluluk (Backward Compatibility):**  
  Eğer öğretmenin girdiği kod veritabanındaki `TeacherInviteCode` tablosunda bulunamazsa, sistem otomatik olarak `process.env.TEACHER_SIGNUP_CODE` değerini kontrol eder (`src/lib/accounts/account-service.ts`).
- Böylece mevcut canlı ortamınız kesintiye uğramaz; admin panelinden yeni davet kodları üretildikçe env koduna olan bağımlılık tamamen ortadan kalkar.

---

## 5. Hangi Prisma Modelleri Eklendi ve Güncellendi?

### Güncellenen Modeller
- **`User`:**
  - `isActive Boolean @default(true)`: Kullanıcıyı silmeden askıya alma/pasifleştirme.
  - `disabledAt DateTime?`: Askıya alınma zaman damgası.
  - `createdInviteCodes`: Adminin oluşturduğu davet kodları ilişkisi.
  - `inviteUsages`: Öğretmenin kullandığı davet kodları ilişkisi.
  - `auditLogs`: Admin işlem geçmişi ilişkisi.
- **`Classroom`:**
  - `description String?`: Sınıf açıklaması veya dönemsel notlar.
  - `archivedAt DateTime?`: Sınıfı soft-delete / arşivleme zaman damgası.
  - `@@index([teacherId, archivedAt])`: Hızlı filtreleme için bileşik indeks.

### Yeni Eklenen Modeller
- **`TeacherInviteCode`:**  
  `id`, `code` (unique), `createdById`, `maxUses`, `usesCount`, `expiresAt`, `isActive`, `note`, `createdAt`.
- **`TeacherInviteUsage`:**  
  `id`, `inviteCodeId`, `userId`, `usedAt` (Bileşik unique: `[inviteCodeId, userId]`).
- **`AuditLog`:**  
  `id`, `adminId`, `action`, `entityType`, `entityId`, `metadata` (JSON), `createdAt`.
- **`SystemSetting`:**  
  `id`, `key` (unique), `value`, `updatedAt`, `updatedBy`.

---

## 6. Migration Dosyaları

- **PostgreSQL (Canlı / Production Ortamı):**  
  `prisma/migrations/20261008120000_admin_classrooms_invites/migration.sql`
- **SQLite (Yerel Test Ortamı):**  
  `prisma/dev-sqlite/migrations/20261008120000_admin_classrooms_invites/migration.sql`

Her iki şema ve migration dosyası `tests/schema-sync.test.ts` ile doğrulanmış ve birebir senkronize edilmiştir.

---

## 7. Kullanıcıyı Devre Dışı Bırakma (User Disable) Sistemi Nasıl Çalışıyor?

- **Soft-Disable Mekanizması:**  
  Bir kullanıcı askıya alındığında veritabanında `isActive = false` ve `disabledAt = NOW()` yapılır. Hiçbir öğrenci raporu, ödev cevabı veya sınıf verisi silinmez.
- **Anında Erişim Engeli:**  
  - Giriş ekranında (`authenticate`): `HESAP_DEVRE_DISI` hatası döner ("Hesabınız sistem yöneticisi tarafından askıya alınmıştır.").
  - Aktif oturumlarda (`getCurrentUser`, `getCurrentTeacher`, `getCurrentStudent`): Kullanıcı pasife alındığı anda API ve sayfalarda `403 Forbidden` yanıtı alır.
- **Admin Güvenlik Koruması:**  
  Adminler kendi kendilerini devre dışı bırakamaz (`CANNOT_DISABLE_SELF` koruması).
- **Geri Alınabilirlik:**  
  Admin tek tıkla hesabı yeniden aktif hale getirebilir (`isActive = true`, `disabledAt = null`).

---

## 8. Denetim İzi (Audit Log) Neleri Kaydediyor?

Aşağıdaki kritik idari işlemler kalıcı olarak `AuditLog` tablosuna yazılır:
- `INVITE_CODE_CREATED`: Yeni öğretmen davet kodu üretildiğinde.
- `INVITE_CODE_STATUS_CHANGED`: Davet kodu aktif/pasif yapıldığında.
- `USER_STATUS_CHANGED`: Bir kullanıcı hesabı askıya alındığında veya aktif edildiğinde.
- `CLASSROOM_ARCHIVED_BY_ADMIN`: Moderasyon kapsamında bir sınıf arşivlendiğinde.
- `ASSIGNMENT_ARCHIVED_BY_ADMIN`: Moderasyon kapsamında bir görev arşivlendiğinde.
- `STALE_AI_RECOVERY_TRIGGERED`: Takılı kalmış AI süreçleri kurtarıldığında.
- `SETTINGS_UPDATED`: Platform ayarları güncellendiğinde.

Her kayıtta işlem yapan adminin ID'si, eylem türü, etkilenen varlığın ID'si, tarih ve metadata JSON verisi tutulur.

---

## 9. Admin Hangi Kullanıcı Verilerini Görebilir?

Admin yalnızca **operasyonel ve yönetimsel özet verileri** görebilir:
- Ad Soyad ve E-posta adresi
- Kullanıcı Rolü (Öğretmen, Öğrenci, Admin)
- Hesap Durumu (Aktif veya Askıda)
- Kayıt Tarihi
- Sınıf Sayısı, Görev Sayısı, Öğrenci Sayısı gibi toplu istatistikler

---

## 10. Admin Hangi Yıkıcı (Destructive) İşlemleri Yapabilir?

- **Sınıf ve Görev Moderasyonu:**  
  Admin uygunsuz sınıfları ve görevleri doğrudan silebilir mi? Hayır; veri bütünlüğünü ve öğrenci başarı raporlarını korumak amacıyla tüm işlemler **soft-delete / arşivleme** şeklinde yapılır.
- **Kullanıcı Askıya Alma:**  
  Kullanıcıları sistemden silmek yerine güvenle askıya alabilir.
- **Kesin Güvence:**  
  Admin paneli üzerinden veya API aracılığıyla MEB kazanımları, geçmiş öğrenci sınav yanıtları veya kullanıcı kayıtları kalıcı olarak silinemez (hard delete engellenmiştir).

---

## 11. Hangi Gizli Değerler (Secrets) Admin Panelinden Gizlenmektedir?

- `passwordHash`: Parola hash'leri kesinlikle okunamaz, arayüze gönderilmez ve API yanıtlarına dahil edilmez.
- `passwordResetToken` ve hash'leri.
- `EVREN_API_KEY`, `RESEND_API_KEY`, `SESSION_SECRET`, `DATABASE_URL`: Bu çevre değişkenlerinin değerleri ekranda açıkta gösterilmez; AI Durumu panelinde yalnızca "Yapılandırıldı" / "Eksik" şeklinde maskeli sağlık durumu sunulur.

---

## 12. Sınıf Yönetimi (Güncelleme / Silme / Arşivleme) Detayları

Öğretmenler `/ogretmen/siniflar/[id]` ekranındaki "Sınıfı Yönet" menüsü ile:
1. **Sınıfı Düzenle:** Sınıf adını ve açıklamasını güncelleyebilir.
2. **Kazanım / Seviye Güvenliği:** Sınıfta önceden oluşturulmuş bir görev varsa sınıf seviyesi (grade) değiştirilemez (`GRADE_CONFLICT` hatası döner); böylece MEB müfredat uyumsuzlukları engellenir.
3. **Katılım Kodunu Yenile:** Sınıf kodu yenilendiğinde eski kod anında geçersiz olur, mevcut kayıtlı öğrenciler sınıfta kalır, yeni katılanlar yeni kodu kullanır.
4. **Akıllı Silme / Arşivleme:**
   - Sınıf tamamen boşsa (0 öğrenci, 0 görev) -> **Kalıcı Silme (Hard Delete)** yapılır.
   - Sınıfta öğrenci veya görev verisi varsa -> **Arşivleme (Soft Delete / `archivedAt`)** yapılır.
5. **Geri Yükleme:** Arşivlenen sınıflar "Arşivlenmiş Sınıflar" sekmesinden görüntülenebilir ve istendiğinde tek tıkla tekrar aktif hale getirilebilir.

---

## 13. Maskot "Etüt" İnteraktif Chatbot Dönüşümü

Sağ alt köşedeki baykuş maskot "Etüt" tam teşekküllü bir yardımcı asistana dönüştürülmüştür:
1. **Rol ve Sayfa Bağlamına Duyarlı:** Kullanıcının rolüne (Öğretmen / Öğrenci / Misafir) ve bulunduğu sayfaya (ör. `/ogretmen/gorevler/yeni` veya `/ogrenci/gorevler`) göre özel hızlı öneri butonları (quick chips) sunar.
2. **EVREN Entegrasyonu & Hızlı Yanıt:** `/api/assistant/chat` endpoint'i üzerinden EVREN LLM ile haberleşir (düşük reasoning effort, 12s timeout).
3. **Deterministik Bilgi Tabanı:** Ağ veya model gecikmelerinde anında devreye giren yerel Türkçe bilgi bankası sayesinde sonsuz bekleme/spinner asla yaşanmaz.
4. **Kullanıcı Dostu Tasarım:** Mobil uyumlu, kapatıldığında son durumu hatırlayan, animasyon azaltma (`prefers-reduced-motion`) desteğine sahip modern arayüz.

---

## 14. Doğrulama ve Test Sonuçları

Tüm kalite güvence adımları eksiksiz tamamlanmıştır:

- **TypeScript Tip Kontrolü:**  
  `npm run typecheck`  
  *Sonuç:* **0 Hata**
- **Kod Standartları (Lint):**  
  `npm run lint`  
  *Sonuç:* **0 Hata, 0 Uyarı**
- **Otomasyon Testleri:**  
  `npm test`  
  *Sonuç:* **18 test dosyası, 133 test BAŞARILI** (3 canlı EVREN testi ortam anahtarı olmadığı için güvenle atlandı, 0 hata).
- **Üretim Derlemesi:**  
  `npm run build`  
  *Sonuç:* **BAŞARILI** (Next.js 16.4.0 Turbopack ile tüm 46 statik ve dinamik rota hatasız derlendi).

---

## 15. Production'a Almadan Önce İzlenecek Adımlar

1. **Veritabanı Migration:**  
   Vercel / Production PostgreSQL veritabanında migration'ı çalıştırın:
   ```bash
   npx prisma migrate deploy
   ```
2. **İlk Admin Hesabını Oluşturma:**  
   Canlı veritabanı ortam değişkeni tanımlı terminalde:
   ```bash
   npm run admin:create -- --allow-remote --email=admin@evdeetut.k12.tr --name="Sistem Yöneticisi"
   ```
3. **İlk Öğretmen Davet Kodunu Oluşturma:**  
   Oluşturulan admin hesabıyla `/giris` üzerinden oturum açın, `/admin/davet-kodlari` sayfasına gidin ve "Yeni Davet Kodu Oluştur" butonuna basarak ilk kodunuzu üretin.
