// GET & POST /api/admin/settings – manage high-level safe application settings

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

const DEFAULT_SETTINGS: Record<string, string> = {
  platformName: "Evde Etüt",
  supportEmail: "destek@evdeetut.k12.tr",
  teacherSignupsEnabled: "true",
  studentSignupsEnabled: "true",
  defaultSuccessScore: "70",
  defaultQuestionCount: "7",
  maintenanceMode: "false",
};

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const rows = await prisma.systemSetting.findMany();
  const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ ok: true, data: settings });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(400, "Geçersiz veri.");

  const allowedKeys = Object.keys(DEFAULT_SETTINGS);
  const updatedEntries: Record<string, string> = {};

  for (const [key, val] of Object.entries(body)) {
    if (allowedKeys.includes(key) && typeof val === "string") {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: val },
        update: { value: val },
      });
      updatedEntries[key] = val;
    }
  }

  await recordAuditLog({
    adminId: admin.id,
    action: "SYSTEM_SETTINGS_UPDATE",
    entityType: "SystemSetting",
    metadata: updatedEntries,
  });

  return NextResponse.json({ ok: true, data: updatedEntries });
}
