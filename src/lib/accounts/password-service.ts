// Password reset (forgot password) and password change/creation from the profile.
//
// Reset tokens: 32 random bytes (base64url) sent by e-mail; only their SHA-256 hash is stored.
// They expire after 30 minutes and are single-use. Requests never reveal whether an account exists.
// A successful reset or change bumps User.sessionVersion, which signs out every other session.

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";
import { passwordResetEmail, type MailProvider } from "../mail/mail-service.ts";

export const RESET_TOKEN_TTL_MS = 30 * 60_000;
/** At most this many reset e-mails per account within RESET_WINDOW_MS. */
export const RESET_MAX_PER_WINDOW = 3;
export const RESET_WINDOW_MS = 15 * 60_000;

export const RESET_REQUESTED_MESSAGE = "Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.";
const INVALID_LINK = "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.";

type Status = 400 | 401 | 404;
const fail = (status: Status, code: string, message: string, field = "_form") => ({ ok: false as const, status, code, message, field });

export const hashResetToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

const newPassword = z.string().min(8, "Şifre en az 8 karakter olmalıdır.").max(200, "Şifre en fazla 200 karakter olabilir.");

export interface ResetRequestDeps {
  db?: PrismaClient;
  mailer: MailProvider | null;
  baseUrl: string;
  now?: Date;
}

/**
 * Create a reset token and e-mail the link. Always resolves the same way whether or not the
 * account exists, is rate-limited, or the e-mail fails (failures are only reported as `sent: false`
 * to the caller for logging, never to the user).
 */
export async function requestPasswordReset(rawEmail: unknown, { db = defaultPrisma, mailer, baseUrl, now = new Date() }: ResetRequestDeps) {
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(rawEmail);
  if (!email.success) return { sent: false, reason: "INVALID_EMAIL" as const };
  const user = await db.user.findUnique({ where: { email: email.data }, select: { id: true, name: true, email: true } });
  if (!user) return { sent: false, reason: "NO_ACCOUNT" as const };
  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - RESET_WINDOW_MS) } } });
  if (recent >= RESET_MAX_PER_WINDOW) return { sent: false, reason: "RATE_LIMITED" as const };
  if (!mailer) return { sent: false, reason: "MAIL_NOT_CONFIGURED" as const };

  const token = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS), createdAt: now },
  });
  const link = `${baseUrl}/sifre-sifirla?token=${encodeURIComponent(token)}`;
  try {
    await mailer.send(passwordResetEmail(user.email, user.name, link));
  } catch {
    return { sent: false, reason: "MAIL_FAILED" as const };
  }
  return { sent: true, reason: null };
}

async function findUsableToken(db: PrismaClient, token: unknown, now: Date) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  if (!row || row.usedAt || row.expiresAt <= now) return null;
  return row;
}

/** For the reset page: is the link still usable? (Does not consume it.) */
export async function isResetTokenValid(token: unknown, db: PrismaClient = defaultPrisma, now = new Date()) {
  return (await findUsableToken(db, token, now)) !== null;
}

const resetSchema = z
  .object({ token: z.string().min(1, INVALID_LINK), password: newPassword, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "Şifreler birbiriyle aynı değil." });

/** Set a new password with a reset token. The token is consumed atomically (second use fails). */
export async function resetPassword(input: unknown, db: PrismaClient = defaultPrisma, now = new Date()) {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(400, "VALIDATION", issue.message, String(issue.path[0] ?? "_form"));
  }
  const row = await findUsableToken(db, parsed.data.token, now);
  if (!row) return fail(400, "INVALID_TOKEN", INVALID_LINK);
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const done = await db.$transaction(async (tx) => {
    // Conditional update: only one concurrent request can consume the token.
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    // Any other outstanding links for this account stop working too.
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
    return true;
  });
  if (!done) return fail(400, "INVALID_TOKEN", INVALID_LINK);
  return { ok: true as const };
}

const changeSchema = z
  .object({ currentPassword: z.string().max(200).optional(), password: newPassword, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "Şifreler birbiriyle aynı değil." });

/**
 * Change the password (current password required) or, for an account without a local password
 * (created with Google), create one. Returns the new session version so the caller can keep the
 * current browser signed in while other sessions are signed out.
 */
export async function changePassword(userId: string, input: unknown, db: PrismaClient = defaultPrisma) {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(400, "VALIDATION", issue.message, String(issue.path[0] ?? "_form"));
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, passwordHash: true } });
  if (!user) return fail(404, "NOT_FOUND", "Hesap bulunamadı.");
  if (user.passwordHash) {
    if (!parsed.data.currentPassword || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return fail(401, "BAD_PASSWORD", "Mevcut şifre hatalı.", "currentPassword");
    }
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10), sessionVersion: { increment: 1 } },
    select: { id: true, role: true, sessionVersion: true },
  });
  return { ok: true as const, data: { ...updated, created: !user.passwordHash } };
}
