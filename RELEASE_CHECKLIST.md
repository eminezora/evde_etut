# Release Checklist

- [ ] UI review completed (öğretmen ve öğrenci ekranları, mobil ve masaüstü)
- [ ] demo seed working (`npm run demo` → DEMO5A sınıfı, 5 öğrenci, yayınlanmış + taslak görev)
- [ ] teacher flow tested (sınıf → görev → MEB çıktısı → içerik → onayla ve yayınla → analiz)
- [ ] student flow tested (katılma kodu → özet → onay → ön bilgi kontrolü → sonuç)
- [ ] EVREN API tested (`npm run test:evren`)
- [ ] MEB curriculum verified (`npm run curriculum` → 1432 çıktı, 43 REVIEW_REQUIRED)
- [ ] authorization tested (başka öğretmen/öğrenci/taslak/süresi geçmiş erişimleri reddediliyor)
- [ ] analytics tested (Yarınki Derse Hazırlık Raporu, CSV, yazdırma)
- [ ] mobile tested
- [ ] lint passed (`npm run lint`)
- [ ] typecheck passed (`npm run typecheck`)
- [ ] tests passed (`npm test`)
- [ ] build passed (`npm run build`)
- [ ] secrets protected (`.env`, `.env.local` git'e girmiyor; istemci paketinde anahtar yok)
- [ ] GitHub ready (README → Production Deployment → 1. adım)
- [ ] Vercel ready (environment variables girildi, `db:deploy` ve `curriculum` çalıştırıldı)
