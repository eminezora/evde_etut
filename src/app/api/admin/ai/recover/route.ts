// POST /api/admin/ai/recover – triggers safe recovery of any stuck stale RUNNING generations

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { recoverAllStaleGenerations } from "@/lib/content/content-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const recoveredCount = await recoverAllStaleGenerations(prisma);

  await recordAuditLog({
    adminId: admin.id,
    action: "AI_STALE_RECOVERY",
    entityType: "ContentGenerationLog",
    metadata: { recoveredCount },
  });

  return NextResponse.json({
    ok: true,
    recoveredCount,
    message: `${recoveredCount} adet takılı kalan içerik oluşturma kaydı güvenle zaman aşımına çekildi.`,
  });
}
