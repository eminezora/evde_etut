// Admin service for managing TeacherInviteCode entities.

import { type PrismaClient } from "@prisma/client";
import { generateTeacherInviteCode } from "../accounts/account-service.ts";
import { prisma as defaultPrisma } from "../db.ts";
import { recordAuditLog } from "./audit-service.ts";

export interface CreateInviteCodeInput {
  maxUses?: number;
  expiresAt?: Date | null;
}

export async function createTeacherInvite(
  adminId: string,
  input: CreateInviteCodeInput,
  db: PrismaClient = defaultPrisma
) {
  const maxUses = Math.max(1, Math.min(1000, Number(input.maxUses) || 1));
  const expiresAt = input.expiresAt ?? null;

  for (let i = 0; i < 5; i++) {
    try {
      const code = generateTeacherInviteCode();
      const created = await db.teacherInviteCode.create({
        data: {
          code,
          maxUses,
          expiresAt,
          createdById: adminId,
        },
      });

      await recordAuditLog(
        {
          adminId,
          action: "INVITE_CODE_CREATE",
          entityType: "TeacherInviteCode",
          entityId: created.id,
          metadata: { code, maxUses, expiresAt: expiresAt?.toISOString() },
        },
        db
      );

      return { ok: true as const, data: created };
    } catch {
      // Collision retry
    }
  }

  return { ok: false as const, message: "Davet kodu üretilemedi, lütfen tekrar deneyin." };
}

export async function listTeacherInvites(db: PrismaClient = defaultPrisma) {
  return db.teacherInviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      usages: {
        orderBy: { usedAt: "desc" },
        include: {
          teacher: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
        },
      },
    },
  });
}

export async function setTeacherInviteStatus(
  adminId: string,
  codeId: string,
  isActive: boolean,
  db: PrismaClient = defaultPrisma
) {
  const code = await db.teacherInviteCode.findUnique({ where: { id: codeId } });
  if (!code) return { ok: false as const, message: "Davet kodu bulunamadı." };

  const updated = await db.teacherInviteCode.update({
    where: { id: codeId },
    data: { isActive },
  });

  await recordAuditLog(
    {
      adminId,
      action: isActive ? "INVITE_CODE_ACTIVATE" : "INVITE_CODE_DEACTIVATE",
      entityType: "TeacherInviteCode",
      entityId: code.id,
      metadata: { code: code.code, isActive },
    },
    db
  );

  return { ok: true as const, data: updated };
}
