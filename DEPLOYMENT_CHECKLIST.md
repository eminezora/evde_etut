# Deployment Checklist

## Repository
- [ ] Git repository clean (`git status` temiz; `.env`, `*.db`, `node_modules`, `.next` commit edilmemiş)
- [ ] Secrets removed (kaynak kodda API anahtarı, şifre, veritabanı adresi yok)
- [ ] `.env.example` updated

## Database
- [ ] Production database created (PostgreSQL)
- [ ] DATABASE_URL configured (Vercel'de pooled adres; gerekiyorsa `?pgbouncer=true&connection_limit=1`)
- [ ] `prisma migrate deploy` successful (`DATABASE_URL=<direct> npm run db:deploy`)
- [ ] curriculum seed successful (`DATABASE_URL=<direct> npm run curriculum`; 1432 outcome, 43 REVIEW_REQUIRED)

## Configuration
- [ ] AUTH_SECRET configured (≥32 rastgele karakter)
- [ ] TEACHER_SIGNUP_CODE configured (öğretmen kaydı için)
- [ ] AI configuration added if used (`AI_PROVIDER=evren`, `EVREN_LLM_BASE_URL`, `EVREN_LLM_API_KEY`, `EVREN_LLM_MODEL`)

## Quality gates
- [ ] lint successful (`npm run lint`)
- [ ] typecheck successful (`npm run typecheck`)
- [ ] tests successful (`npm test`)
- [ ] production build successful (`npm run build`)

## Vercel
- [ ] Vercel deploy successful

## Production smoke test (PRODUCTION_SMOKE_TEST.md)
- [ ] Teacher login tested
- [ ] Student login tested
- [ ] Classroom flow tested (oluşturma + katılma kodu)
- [ ] Assignment flow tested
- [ ] AI/manual content flow tested
- [ ] Assessment tested
- [ ] READY_FOR_CLASS tested
- [ ] Teacher reports tested (Öğrenciler sekmesi, Değerlendirme Bekleyenler)
