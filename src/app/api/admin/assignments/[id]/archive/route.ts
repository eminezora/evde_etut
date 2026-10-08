// POST /api/admin/assignments/[id]/archive – Admin moderation archive / unarchive for assignments

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const { id } = await params;
  const assignment = await prisma.assignment.findUnique({ where: { id }, select: { id: true, topic: true, archivedAt: true } });
  if (!assignment) return jsonError(404, "Görev bulunamadı.");

  const body = await request.json().catch(() => null);
  const shouldArchive = body?.archive !== undefined ? Boolean(body.archive) : assignment.archivedAt === null;

  const updated = await prisma.assignment.update({
    where: { id },
    data: { archivedAt: shouldArchive ? new Date() : null },
    select: { id: true, topic: true, archivedAt: true },
  });

  await recordAuditLog({
    adminId: admin.id,
    action: shouldArchive ? "ASSIGNMENT_ARCHIVE" : "ASSIGNMENT_UNARCHIVE",
    entityType: "Assignment",
    entityId: assignment.id,
    metadata: { topic: assignment.topic, archived: shouldArchive },
  });

  return NextResponse.json({ ok: true, data: updated });
}
