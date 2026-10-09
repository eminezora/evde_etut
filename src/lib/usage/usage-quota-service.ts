// Usage quotas for costly AI features. Server-side and authoritative: every EVREN call that costs
// money goes through reserveUsage() first, so hiding a button in the UI is never the only guard.
//
// Lifecycle of one use (one AI draft job, one DersBot message):
//   reserveUsage  → before EVREN is called; atomically takes one unit or answers USAGE_LIMIT_REACHED
//   commitUsage   → the AI answer was used (draft saved / reply shown): the unit stays spent
//   refundUsage   → failure, timeout or invalid answer: the unit is given back
// Rule: only successful AI use counts. Reserved units already count against the limit, so
// parallel requests can't overshoot it. correlationId (job id / message id) makes it idempotent:
// retries, hedged requests and duplicate submissions of the same job never count twice.
//
// Resolution: a valid UserQuotaOverride wins over the role's UsageQuotaPolicy; no active policy
// (or unlimited) means the feature is not limited for that user.

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.ts";
import { PERIOD_LABELS, formatResetDate, isPeriodType, periodBounds, resetHint, type PeriodType } from "./period.ts";

export const USAGE_FEATURES = ["AI_CONTENT_GENERATION", "AI_ASSISTANT_MESSAGE"] as const;
export type UsageFeature = (typeof USAGE_FEATURES)[number];
export const isUsageFeature = (v: unknown): v is UsageFeature => typeof v === "string" && (USAGE_FEATURES as readonly string[]).includes(v);

export const FEATURE_LABELS: Record<UsageFeature, string> = {
  AI_CONTENT_GENERATION: "AI Ders Taslağı",
  AI_ASSISTANT_MESSAGE: "DersBot Sohbet",
};
export const FEATURE_UNITS: Record<UsageFeature, string> = { AI_CONTENT_GENERATION: "kullanım", AI_ASSISTANT_MESSAGE: "mesaj" };

/** Features a role can use at all (students never generate content, so they never see that quota). */
export const ROLE_FEATURES: Record<string, UsageFeature[]> = {
  TEACHER: ["AI_CONTENT_GENERATION", "AI_ASSISTANT_MESSAGE"],
  STUDENT: ["AI_ASSISTANT_MESSAGE"],
  ADMIN: ["AI_CONTENT_GENERATION", "AI_ASSISTANT_MESSAGE"],
};

export const USAGE_LIMIT_REACHED = "USAGE_LIMIT_REACHED";

type Db = PrismaClient | Prisma.TransactionClient;
export interface QuotaUser {
  id: string;
  role: string;
}

export interface ResolvedQuota {
  periodType: PeriodType;
  limit: number;
  unlimited: boolean;
  source: "OVERRIDE" | "ROLE" | "NONE";
  validUntil: Date | null;
}

export interface QuotaStatus extends ResolvedQuota {
  feature: UsageFeature;
  label: string;
  unit: string;
  used: number;
  remaining: number | null; // null = unlimited
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  resetHint: string;
}

export async function resolveQuota(db: Db, user: QuotaUser, feature: UsageFeature, now = new Date()): Promise<ResolvedQuota> {
  const override = await db.userQuotaOverride.findUnique({ where: { userId_feature: { userId: user.id, feature } } });
  if (override && (!override.validUntil || override.validUntil > now) && isPeriodType(override.periodType)) {
    return { periodType: override.periodType, limit: override.limit, unlimited: override.unlimited, source: "OVERRIDE", validUntil: override.validUntil };
  }
  const policy = await db.usageQuotaPolicy.findUnique({ where: { role_feature: { role: user.role, feature } } });
  if (policy && policy.isActive && isPeriodType(policy.periodType)) {
    return { periodType: policy.periodType, limit: policy.limit, unlimited: policy.unlimited, source: "ROLE", validUntil: null };
  }
  return { periodType: "DAILY", limit: 0, unlimited: true, source: "NONE", validUntil: null };
}

export async function getQuotaStatus(db: Db, user: QuotaUser, feature: UsageFeature, now = new Date()): Promise<QuotaStatus> {
  const q = await resolveQuota(db, user, feature, now);
  const { start, end } = periodBounds(q.periodType, now);
  const counter = await db.usageCounter.findUnique({
    where: { userId_feature_periodType_periodStart: { userId: user.id, feature, periodType: q.periodType, periodStart: start } },
  });
  const used = counter?.used ?? 0;
  return {
    ...q,
    feature,
    label: FEATURE_LABELS[feature],
    unit: FEATURE_UNITS[feature],
    used,
    remaining: q.unlimited ? null : Math.max(0, q.limit - used),
    periodStart: start,
    periodEnd: end,
    periodLabel: PERIOD_LABELS[q.periodType],
    resetHint: resetHint(q.periodType, end, now),
  };
}

/** The user's own quotas (only the features their role uses). */
export async function getUsageSummary(user: QuotaUser, db: PrismaClient = defaultPrisma, now = new Date()) {
  const features = ROLE_FEATURES[user.role] ?? [];
  return Promise.all(features.map((f) => getQuotaStatus(db, user, f, now)));
}

/** Turkish message shown when a limit is reached (never a technical error). */
export function limitReachedMessage(feature: UsageFeature, periodType: PeriodType, periodEnd: Date) {
  const date = formatResetDate(periodEnd);
  if (feature === "AI_ASSISTANT_MESSAGE") {
    if (periodType === "DAILY") return "Bugünkü DersBot kullanım hakkınızı tamamladınız. Yeni hakkınız yarın yenilenecek.";
    return `${PERIOD_LABELS[periodType]} DersBot kullanım hakkınızı tamamladınız. Kotanız ${date} tarihinde yenilenecek.`;
  }
  if (periodType === "DAILY") return "Bugünkü yapay zekâ kullanım hakkınızı tamamladınız. Yeni kullanım hakkınız yarın yenilenecek.";
  return `${PERIOD_LABELS[periodType]} kullanım hakkınızı tamamladınız. Kotanız ${date} tarihinde yenilenecek.`;
}

export type ReserveResult =
  | { ok: true; eventId: string; alreadyCounted: boolean; unlimited: boolean; remaining: number | null }
  | { ok: false; status: 429; code: typeof USAGE_LIMIT_REACHED; message: string; quota: QuotaStatus };

class LimitReached extends Error {}

/**
 * Take one unit (or `amount`) before the AI is called. Atomic: the counter is only incremented by a
 * guarded UPDATE (used + amount <= limit), so two parallel requests can never both take the last unit.
 * Idempotent per correlationId.
 */
export async function reserveUsage(
  user: QuotaUser,
  feature: UsageFeature,
  correlationId: string,
  { db = defaultPrisma, amount = 1, now = new Date() }: { db?: PrismaClient; amount?: number; now?: Date } = {},
): Promise<ReserveResult> {
  const existing = await db.usageEvent.findUnique({ where: { userId_feature_correlationId: { userId: user.id, feature, correlationId } } });
  if (existing && existing.status !== "REFUNDED") {
    return { ok: true, eventId: existing.id, alreadyCounted: true, unlimited: existing.counterId === null, remaining: existing.remainingAfter };
  }

  const quota = await resolveQuota(db, user, feature, now);
  const { start } = periodBounds(quota.periodType, now);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        let counterId: string | null = null;
        let remainingAfter: number | null = null;
        if (!quota.unlimited) {
          const key = { userId: user.id, feature, periodType: quota.periodType, periodStart: start };
          const counter = await tx.usageCounter.upsert({ where: { userId_feature_periodType_periodStart: key }, create: { ...key, used: 0 }, update: {} });
          const taken = await tx.usageCounter.updateMany({ where: { id: counter.id, used: { lte: quota.limit - amount } }, data: { used: { increment: amount } } });
          if (taken.count !== 1) throw new LimitReached();
          const after = await tx.usageCounter.findUniqueOrThrow({ where: { id: counter.id }, select: { used: true } });
          counterId = counter.id;
          remainingAfter = Math.max(0, quota.limit - after.used);
        }
        const data = { status: "RESERVED", amount, counterId, remainingAfter, createdAt: now };
        const event = existing
          ? await tx.usageEvent.update({ where: { id: existing.id }, data })
          : await tx.usageEvent.create({ data: { userId: user.id, feature, correlationId, ...data } });
        return { ok: true as const, eventId: event.id, alreadyCounted: false, unlimited: quota.unlimited, remaining: remainingAfter };
      });
    } catch (e) {
      if (e instanceof LimitReached) {
        const status = await getQuotaStatus(db, user, feature, now);
        return { ok: false, status: 429, code: USAGE_LIMIT_REACHED, message: limitReachedMessage(feature, status.periodType, status.periodEnd), quota: status };
      }
      // A parallel request created the same counter or event row first: try again (idempotent).
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034")) {
        const dup = await db.usageEvent.findUnique({ where: { userId_feature_correlationId: { userId: user.id, feature, correlationId } } });
        if (dup && dup.status !== "REFUNDED") return { ok: true, eventId: dup.id, alreadyCounted: true, unlimited: dup.counterId === null, remaining: dup.remainingAfter };
        continue;
      }
      throw e;
    }
  }
  throw new Error("Kullanım hakkı ayrılamadı.");
}

/** The reserved unit was used successfully (no-op if already committed or refunded). */
export async function commitUsage(userId: string, feature: UsageFeature, correlationId: string, db: PrismaClient = defaultPrisma) {
  const r = await db.usageEvent.updateMany({ where: { userId, feature, correlationId, status: "RESERVED" }, data: { status: "COMMITTED" } });
  return r.count === 1;
}

/** Give a reserved unit back (failure / timeout). Safe to call twice: only a RESERVED event is refunded. */
export async function refundUsage(userId: string, feature: UsageFeature, correlationId: string, db: PrismaClient = defaultPrisma) {
  return db.$transaction(async (tx) => {
    const event = await tx.usageEvent.findUnique({ where: { userId_feature_correlationId: { userId, feature, correlationId } } });
    if (!event || event.status !== "RESERVED") return false;
    const flipped = await tx.usageEvent.updateMany({ where: { id: event.id, status: "RESERVED" }, data: { status: "REFUNDED" } });
    if (flipped.count !== 1) return false;
    if (event.counterId) {
      await tx.usageCounter.updateMany({ where: { id: event.counterId, used: { gte: event.amount } }, data: { used: { decrement: event.amount } } });
    }
    return true;
  });
}

/** Refund every reservation older than `olderThanMs` that never finished (crashed/killed jobs). */
export async function refundStaleReservations(olderThanMs: number, db: PrismaClient = defaultPrisma, now = new Date()) {
  const stale = await db.usageEvent.findMany({ where: { status: "RESERVED", createdAt: { lt: new Date(now.getTime() - olderThanMs) } }, select: { userId: true, feature: true, correlationId: true } });
  let n = 0;
  for (const e of stale) if (isUsageFeature(e.feature) && (await refundUsage(e.userId, e.feature, e.correlationId, db))) n++;
  return n;
}

/** The user's own recent uses (successful and refunded). */
export async function listUsageHistory(userId: string, db: PrismaClient = defaultPrisma, take = 20) {
  const rows = await db.usageEvent.findMany({
    where: { userId, status: { in: ["COMMITTED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, feature: true, amount: true, status: true, remainingAfter: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, label: isUsageFeature(r.feature) ? FEATURE_LABELS[r.feature] : r.feature }));
}

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

export const QUOTA_ROLES = ["TEACHER", "STUDENT", "ADMIN"] as const;

export const listPolicies = (db: PrismaClient = defaultPrisma) => db.usageQuotaPolicy.findMany({ orderBy: [{ role: "asc" }, { feature: "asc" }] });

export interface PolicyInput {
  role: string;
  feature: string;
  periodType: string;
  limit: number;
  unlimited: boolean;
  isActive: boolean;
}

export function validatePolicyInput(input: Partial<PolicyInput>): string | null {
  if (!input.role || !(QUOTA_ROLES as readonly string[]).includes(input.role)) return "Geçersiz rol.";
  if (!isUsageFeature(input.feature)) return "Geçersiz özellik.";
  if (!isPeriodType(input.periodType)) return "Periyot günlük, haftalık veya aylık olmalıdır.";
  if (!input.unlimited && (!Number.isInteger(input.limit) || (input.limit as number) < 0 || (input.limit as number) > 100000)) return "Limit 0 ile 100000 arasında bir tam sayı olmalıdır.";
  return null;
}

export async function upsertPolicy(input: PolicyInput, db: PrismaClient = defaultPrisma) {
  const data = { periodType: input.periodType, limit: input.unlimited ? 0 : input.limit, unlimited: input.unlimited, isActive: input.isActive };
  return db.usageQuotaPolicy.upsert({ where: { role_feature: { role: input.role, feature: input.feature } }, create: { role: input.role, feature: input.feature, ...data }, update: data });
}

export interface OverrideInput {
  userId: string;
  feature: string;
  periodType: string;
  limit: number;
  unlimited: boolean;
  validUntil: Date | null;
  note?: string | null;
  createdById?: string | null;
}

export async function setOverride(input: OverrideInput, db: PrismaClient = defaultPrisma) {
  const data = {
    periodType: input.periodType,
    limit: input.unlimited ? 0 : input.limit,
    unlimited: input.unlimited,
    validUntil: input.validUntil,
    note: input.note?.slice(0, 200) || null,
    createdById: input.createdById ?? null,
  };
  return db.userQuotaOverride.upsert({ where: { userId_feature: { userId: input.userId, feature: input.feature } }, create: { userId: input.userId, feature: input.feature, ...data }, update: data });
}

export const deleteOverride = (id: string, db: PrismaClient = defaultPrisma) => db.userQuotaOverride.deleteMany({ where: { id } });

export const listOverrides = (db: PrismaClient = defaultPrisma) =>
  db.userQuotaOverride.findMany({ orderBy: { updatedAt: "desc" }, include: { user: { select: { name: true, email: true, role: true } } } });

/** Every user's current quota per feature (admin view). */
export async function adminUsageReport(
  { role, feature, onlyFull = false, search }: { role?: string; feature?: string; onlyFull?: boolean; search?: string } = {},
  db: PrismaClient = defaultPrisma,
  now = new Date(),
) {
  const users = await db.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 300,
    select: { id: true, name: true, email: true, role: true },
  });
  const rows: (QuotaStatus & { user: (typeof users)[number] })[] = [];
  for (const u of users) {
    for (const f of ROLE_FEATURES[u.role] ?? []) {
      if (feature && f !== feature) continue;
      const s = await getQuotaStatus(db, u, f, now);
      if (onlyFull && (s.unlimited || (s.remaining ?? 1) > 0)) continue;
      rows.push({ ...s, user: u });
    }
  }
  return rows;
}
