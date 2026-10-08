// Audit log service: records administrative operations for compliance and traceability.
// Never logs passwords, API keys, reset tokens, or personal confidential data.

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";

export interface CreateAuditLogInput {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAuditLog(input: CreateAuditLogInput, db: PrismaClient = defaultPrisma) {
  try {
    return await db.auditLog.create({
      data: {
        adminId: input.adminId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonObject) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record audit log:", err);
    return null;
  }
}

export async function listAuditLogs(limit = 50, db: PrismaClient = defaultPrisma) {
  return db.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
