#!/usr/bin/env tsx
// Secure CLI command to create an ADMIN account.
// Usage:
//   npm run admin:create -- --email=admin@okul.test --name="Admin User" --password=SecretPass123 [--allow-remote]

import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    let email = getArg("email");
    let name = getArg("name");
    let password = getArg("password");
    const allowRemote = hasFlag("allow-remote");

    const dbUrl = process.env.DATABASE_URL ?? "";
    const isRemoteDb = !dbUrl.startsWith("file:") && (dbUrl.includes("postgres") || dbUrl.includes("supabase") || dbUrl.includes("neon"));

    if (isRemoteDb && !allowRemote) {
      console.error("\n[UYARI] Canlı veya uzak bir veritabanına bağlanıyorsunuz.");
      console.error("İşleme devam etmek için komuta '--allow-remote' bayrağını ekleyin:");
      console.error("  npm run admin:create -- --email=... --name=... --password=... --allow-remote\n");
      process.exit(1);
    }

    if (!email) {
      email = await rl.question("Admin E-posta adresi: ");
    }
    if (!name) {
      name = await rl.question("Admin Ad Soyad: ");
    }
    if (!password) {
      password = await rl.question("Admin Parolası (en az 8 karakter): ");
    }

    email = email.trim().toLowerCase();
    name = name.trim();
    password = password.trim();

    if (!email || !email.includes("@")) {
      console.error("Geçersiz e-posta adresi.");
      process.exit(1);
    }
    if (!name || name.length < 2) {
      console.error("Ad soyad en az 2 karakter olmalıdır.");
      process.exit(1);
    }
    if (!password || password.length < 8) {
      console.error("Parola en az 8 karakter olmalıdır.");
      process.exit(1);
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`\n'${email}' adresiyle zaten bir kullanıcı mevcut.`);
      console.log("Kullanıcıyı ADMIN rolüne yükseltmek için: npm run admin:promote -- --email=" + email);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        adminId: user.id,
        action: "ADMIN_BOOTSTRAP_CREATE",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email, name: user.name },
      },
    });

    console.log(`\n✅ Başarılı: ADMIN kullanıcısı oluşturuldu!`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Ad: ${user.name}`);
    console.log(`   E-posta: ${user.email}`);
    console.log(`   Rol: ${user.role}\n`);
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Hata:", err);
  process.exit(1);
});
