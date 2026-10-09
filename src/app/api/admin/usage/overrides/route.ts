// GET/POST/DELETE /api/admin/usage/overrides – per-user quota exceptions (admin only).
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { isPeriodType } from "@/lib/usage/period.ts";
import { deleteOverride, isUsageFeature, listOverrides, setOverride } from "@/lib/usage/usage-quota-service.ts";

const FORBIDDEN = "Bu işlemi yalnızca sistem yöneticileri yapabilir.";

export async function GET() {
  if (!(await getCurrentAdmin())) return jsonError(403, FORBIDDEN);
  return NextResponse.json({ ok: true, data: await listOverrides() });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, FORBIDDEN);
  const b = await request.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
  const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
  if (!user) return jsonError(404, "Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.");
  if (!isUsageFeature(b?.feature)) return jsonError(400, "Geçersiz özellik.");
  if (!isPeriodType(b?.periodType)) return jsonError(400, "Periyot günlük, haftalık veya aylık olmalıdır.");
  const unlimited = b?.unlimited === true;
  const limit = Number(b?.limit);
  if (!unlimited && (!Number.isInteger(limit) || limit < 0 || limit > 100000)) return jsonError(400, "Limit 0 ile 100000 arasında bir tam sayı olmalıdır.");
  let validUntil: Date | null = null;
  if (b?.validUntil) {
    validUntil = new Date(b.validUntil);
    if (Number.isNaN(validUntil.getTime()) || validUntil <= new Date()) return jsonError(400, "Bitiş tarihi gelecekte olmalıdır.");
  }
  const saved = await setOverride({ userId: user.id, feature: b.feature, periodType: b.periodType, limit: unlimited ? 0 : limit, unlimited, validUntil, note: typeof b?.note === "string" ? b.note : null, createdById: admin.id });
  await recordAuditLog({ adminId: admin.id, action: "USAGE_OVERRIDE_SET", entityType: "UserQuotaOverride", entityId: saved.id, metadata: { userId: user.id, feature: b.feature, periodType: b.periodType, limit, unlimited, validUntil } });
  return NextResponse.json({ ok: true, data: saved });
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, FORBIDDEN);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const r = await deleteOverride(id);
  if (r.count === 0) return jsonError(404, "Özel limit bulunamadı.");
  await recordAuditLog({ adminId: admin.id, action: "USAGE_OVERRIDE_DELETE", entityType: "UserQuotaOverride", entityId: id });
  return NextResponse.json({ ok: true });
}
