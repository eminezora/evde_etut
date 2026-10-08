// PATCH /api/admin/users/[id]/status – enable or disable a user account

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const { id } = await params;
  if (id === admin.id) {
    return jsonError(400, "Kendi yönetici hesabınızı devre dışı bırakamazsınız.");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError(404, "Kullanıcı bulunamadı.");

  const body = await request.json().catch(() => null);
  const isActive = Boolean(body?.isActive);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive,
      disabledAt: isActive ? null : new Date(),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, disabledAt: true },
  });

  await recordAuditLog({
    adminId: admin.id,
    action: isActive ? "USER_ACTIVATE" : "USER_DISABLE",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, name: user.name, role: user.role, isActive },
  });

  return NextResponse.json({ ok: true, data: updated });
}
