#!/usr/bin/env tsx
// Secure CLI command to promote an existing user to ADMIN.
// Usage:
//   npm run admin:promote -- --email=user@okul.test [--allow-remote]

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const email = getArg("email");
  const allowRemote = hasFlag("allow-remote");

  const dbUrl = process.env.DATABASE_URL ?? "";
  const isRemoteDb = !dbUrl.startsWith("file:") && (dbUrl.includes("postgres") || dbUrl.includes("supabase") || dbUrl.includes("neon"));

  if (isRemoteDb && !allowRemote) {
    console.error("\n[UYARI] Canlı veya uzak bir veritabanına bağlanıyorsunuz.");
    console.error("İşleme devam etmek için komuta '--allow-remote' bayrağını ekleyin:");
    console.error("  npm run admin:promote -- --email=... --allow-remote\n");
    process.exit(1);
  }

  if (!email || !email.includes("@")) {
    console.error("Lütfen geçerli bir e-posta adresi belirtin: --email=kullanici@ornek.com");
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalized } });

  if (!user) {
    console.error(`'${normalized}' adresine sahip kullanıcı bulunamadı.`);
    process.exit(1);
  }

  const previousRole = user.role;
  const updated = await db.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: { id: true, email: true, name: true, role: true },
  });

  await db.auditLog.create({
    data: {
      adminId: user.id,
      action: "USER_PROMOTE_TO_ADMIN",
      entityType: "User",
      entityId: user.id,
      metadata: { previousRole, newRole: "ADMIN", email: user.email },
    },
  });

  console.log(`\n✅ Başarılı: '${updated.name}' (${updated.email}) kullanıcısı ADMIN rolüne yükseltildi!\n`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Hata:", err);
  process.exit(1);
});
