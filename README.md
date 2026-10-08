# Ödev Takip – MEB Hazırlık ve Ön Bilgi Kontrolü

Öğretmenin MEB Türkiye Yüzyılı Maarif Modeli öğrenme çıktılarına bağlı ders öncesi hazırlık
görevi oluşturduğu, öğrencinin özeti okuyup kısa bir ön bilgi kontrolü çözdüğü ve
"Derse hazır" (READY_FOR_CLASS) durumuna geldiği Next.js uygulaması.

- **Next.js 16** (App Router, route handlers), **Prisma 6**, **PostgreSQL** (production) / SQLite (yerel geliştirme)
- Müfredat verisi: `data/curriculum/normalized/all-middle-school.json` (tymm.meb.gov.tr'den doğrulanmış 5–8. sınıf seti)
- İsteğe bağlı yapay zekâ taslak üretimi (EVREN LLM veya Claude API); kapalıyken içerik elle hazırlanır

## Yerel geliştirme

```bash
npm install
cp .env.example .env          # AUTH_SECRET'i doldurun; DATABASE_URL="file:./dev.db" kalabilir
npm run db:migrate            # SQLite dev veritabanını oluşturur (prisma/dev-sqlite/dev.db)
npm run curriculum            # MEB müfredatını yükler (idempotent)
npm run demo                  # isteğe bağlı: demo sınıf ve hesaplar (DEMO_PASSWORD gerekir)
npm run dev
```

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Production build / çalıştırma |
| `npm run lint` · `npm run typecheck` · `npm test` | Kalite kontrolleri (testler geçici bir SQLite dosyası kullanır) |
| `npm run test:postgres` | Aynı testler boş, tek kullanımlık bir PostgreSQL'e karşı (`TEST_POSTGRES_URL` ve `DATABASE_URL`) |
| `npm run db:deploy` | Commit edilmiş migration'ları uygular (`prisma migrate deploy`) |
| `npm run db:migrate` | Yalnızca yerel: yeni SQLite migration'ı oluşturur |
| `npm run curriculum` | Müfredatı veritabanına aktarır (idempotent) |
| `npm run curriculum:report` | Veritabanındaki müfredatı veri setiyle karşılaştırır (salt okunur; sınıf/ders sayıları, duplicate, eksik, URL'siz kayıt) |
| `npm run demo` | Demo sınıf, hesaplar ve görevler – yalnızca sunum içindir |
| `npm run test:evren` | Gerçek EVREN API ile canlı içerik üretim testi |
| `npm run curriculum:fetch` / `curriculum:validate` | MEB veri setini yeniden üretir / doğrular (geliştirici aracı) |

### Demo hesapları (yalnızca geliştirme / sunum)

`npm run demo` yerel veritabanında aşağıdaki demo verisini oluşturur (tekrar çalıştırınca demo sınıfını sıfırlar).
Production'da otomatik çalışmaz; uzak bir veritabanına yazmak için bilerek `-- --allow-remote` eklemek gerekir.

| | |
|---|---|
| Demo Teacher | `ogretmen@demo.local` |
| Demo Student | `ogrenci@demo.local` (ayrıca `ogrenci2`–`ogrenci5@demo.local`) |
| Demo Classroom Code | `DEMO5A` (5/A, 5. sınıf) |
| Şifre | `.env` içindeki `DEMO_PASSWORD` değeri (repo'da şifre yoktur) |

Demo içeriği: "Güneş ve Ay" yayınlanmış görevi (gerçek MEB çıktıları `FB.5.1.1`, `FB.5.1.2`; 6 farklı soru türü),
"Kuvvet ve ölçülmesi" taslak görevi (canlı yapay zekâ demosu için) ve farklı durumlarda öğrenciler
(Derse Hazır, Tekrar Gerekli, Öğretmen Değerlendirmesi Bekleniyor, okuyor, başlamadı). Sunum akışı için `DEMO_SCRIPT.md`.

### EVREN canlı testi

`.env.local` içinde `AI_PROVIDER=evren`, `EVREN_LLM_BASE_URL`, `EVREN_LLM_API_KEY`, `EVREN_LLM_MODEL` tanımlıyken
`npm run test:evren` gerçek API ile bir hazırlık taslağı üretir (birkaç kredi harcar; anahtar yazdırılmaz).
EVREN hesabında kullanım şartlarının (v1) kabul edilmiş olması gerekir.

### İki şema, tek model

- `prisma/schema.prisma` + `prisma/migrations/` → **PostgreSQL** (production, Vercel).
- `prisma/dev-sqlite/schema.prisma` + `prisma/dev-sqlite/migrations/` → yerel SQLite.
- `scripts/db.mjs`, `DATABASE_URL` `file:` ile başlıyorsa SQLite şemasını, aksi hâlde PostgreSQL
  şemasını seçer; npm script'leri Prisma'yı bu sarmalayıcıyla çalıştırır.
- Şema değişikliğinde iki dosyayı da aynı şekilde güncelleyin (`tests/schema-sync.test.ts` kontrol eder),
  `npm run db:migrate` ile SQLite migration'ını, PostgreSQL migration'ını ise şununla üretin:

  ```bash
  npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "$SHADOW_DATABASE_URL" --script > prisma/migrations/<tarih>_<ad>/migration.sql
  ```

## Production Deployment

Production verisi yalnızca PostgreSQL'de tutulur; uygulama dosya sistemine kalıcı veri yazmaz.

### 1. GitHub repository

GitHub'da boş bir repository oluşturun (README eklemeden), ardından proje klasöründe:

```bash
git init
git add .
git status            # .env, *.db, node_modules, .next listede OLMAMALI
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<kullanici>/<repo>.git
git push -u origin main
```

### 2. Environment variables

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | Evet | PostgreSQL bağlantısı (Vercel'de **pooled** adres) |
| `AUTH_SECRET` | Evet | En az 32 karakterlik rastgele değer; oturum çerezlerini imzalar |
| `TEACHER_SIGNUP_CODE` | Öğretmen kaydı için | Öğretmenlerin kayıtta gireceği davet kodu; boşsa öğretmen kaydı kapalıdır (Google ile kayıtta da istenir) |
| `APP_URL` | Önerilir | Sitenin herkese açık adresi (ör. `https://evde-etut.vercel.app`); e-posta bağlantıları ve Google dönüş adresi bundan üretilir |
| `MAIL_PROVIDER` | Hayır | `resend` (varsayılan). `memory` yalnızca test/yerel içindir, production'da yok sayılır |
| `RESEND_API_KEY` | Şifre sıfırlama için | Resend API anahtarı |
| `MAIL_FROM` | Şifre sıfırlama için | Gönderen, Resend'de doğrulanmış alan adıyla: `Evde Etüt <bildirim@alanadiniz.com>` |
| `GOOGLE_CLIENT_ID` | Google girişi için | Google OAuth istemci kimliği; ikisi de doluysa "Google ile devam et" görünür |
| `GOOGLE_CLIENT_SECRET` | Google girişi için | Google OAuth istemci gizli anahtarı |
| `AI_PROVIDER` | Hayır | `evren` veya `anthropic`; boşsa yapay zekâ kapalı, içerik elle hazırlanır |
| `EVREN_LLM_BASE_URL` | `evren` için | `https://evren-llmapi.ssyz.org.tr/v1` |
| `EVREN_LLM_API_KEY` | `evren` için | EVREN API anahtarı (yoksa `AI_API_KEY` kullanılır) |
| `EVREN_LLM_MODEL` | Hayır | Varsayılan `glm-5.3`; karşılaştırma için yalnızca bu değeri değiştirin (`gemma-4-31b`, `qwen3.8-flash-next`) |
| `AI_API_KEY` | `anthropic` için | Anthropic API anahtarı |
| `AI_MODEL` | Hayır | Yalnızca `anthropic`; varsayılan `claude-opus-5-5` |
| `EVREN_LLM_REASONING_EFFORT` | Hayır | `none`/`low`/`medium`/`high`/`off`; varsayılan `low` (glm-5.3 aksi hâlde dakikalarca "düşünür") |
| `AI_TIMEOUT_MS` | Hayır | Varsayılan 90000; route `maxDuration` 180 sn'den küçük olmalı. EVREN yavaş anlarda 120–150 sn sürebildiği için `160000` önerilir |

`DEMO_PASSWORD` production'da gerekmez. `NEXT_PUBLIC_*` değişkeni yoktur; hiçbir secret istemciye gönderilmez.

### 3. PostgreSQL veritabanı

Herhangi bir yönetilen PostgreSQL (ör. Vercel Marketplace'ten Neon, Supabase). İki bağlantı adresi not edin:

- **Pooled** (uygulama için): serverless fonksiyonlar çok sayıda kısa bağlantı açar. PgBouncer/Supabase pooler
  kullanıyorsanız adrese `?pgbouncer=true&connection_limit=1` ekleyin (prepared statement hatalarını önler).
- **Direct** (migration ve seed için).

### 4. DATABASE_URL

Vercel → Project → Settings → Environment Variables: `DATABASE_URL` = pooled adres (Production, gerekirse Preview).

### 5. Prisma migration

Migration'lar build sırasında değil, **bilinçli olarak** ve direct adresle çalıştırılır
(`prisma db push` production için kullanılmaz):

```bash
DATABASE_URL="<direct-postgres-url>" npm run db:deploy      # = prisma migrate deploy
```

İlk kurulumda ve yeni migration içeren her sürümden **önce** çalıştırın.

### 6. Curriculum seed

```bash
DATABASE_URL="<direct-postgres-url>" npm run curriculum:report   # salt okunur: eksik/duplicate kontrolü
DATABASE_URL="<direct-postgres-url>" npm run curriculum          # eksikleri ekler, mevcutları günceller
DATABASE_URL="<direct-postgres-url>" npm run curriculum:report   # sonucu doğrular (eksik 0 olmalı)
```

- İdempotenttir: tekrar çalıştırmak kopya oluşturmaz, mevcut kayıtları günceller (`subject + grade + outcomeCode`).
- `VERIFIED` / `REVIEW_REQUIRED` durumları korunur; REVIEW_REQUIRED kayıtlar öğretmen seçiminde görünmez.
- Uzak veritabanında 1–2 dakika sürebilir. Demo hesap **oluşturmaz**. Hiçbir kaydı silmez; veri setinde
  artık olmayan çıktılar yalnızca `NOT_IN_DATASET` olarak işaretlenir.

### 7. Vercel project import

Vercel → Add New → Project → GitHub repository'sini seçin. Framework: **Next.js** (otomatik).
Varsayılanlar yeterlidir:

- Install Command: varsayılan (`npm install`; `postinstall` Prisma Client'ı üretir)
- Build Command: varsayılan (`npm run build` → `scripts/db.mjs generate && next build`)
- Output: varsayılan (Next.js)

Environment variables'ı (2. adım) bu ekranda girin.

### 8. Build / deploy

Deploy'a basın. Sonraki her `git push` otomatik deploy edilir. Yeni migration içeren bir sürümü
push'lamadan önce 5. adımı çalıştırın.

> Yapay zekâ taslağı arka planda üretilir: istek hemen 202 döner, editör durumu 3 sn'de bir sorgular.
> Arka plan işi en fazla 180 sn çalışabilir (`maxDuration`). Vercel'de **Fluid compute** açık olmalıdır
> (yeni projelerde varsayılan); kapalıysa Hobby planda süre sınırı 60 sn'dir ve taslak üretimi yarıda kalır.

### 9. Production test

`PRODUCTION_SMOKE_TEST.md` adımlarını uygulayın; `DEPLOYMENT_CHECKLIST.md`'yi işaretleyin.

## Güvenlik notları

- Oturum: HS256 imzalı, `httpOnly`, `SameSite=Lax`, production'da `Secure` çerez; 8 saat geçerli.
- Tüm yetki kontrolleri sunucuda: öğretmen yalnızca kendi sınıf/görevlerine, öğrenci yalnızca üyesi olduğu
  sınıfların yayınlanmış ve öğretmen onaylı görevlerine erişir; puan ve durumlar sunucuda hesaplanır.
- Doğru cevaplar öğrenci sayfalarına gönderilmez.
- Giriş için hız sınırlaması (rate limiting) yoktur; açık internette Vercel Firewall/WAF kuralı önerilir.
