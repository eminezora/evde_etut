// POST /api/admin/classrooms/[id]/archive – Admin moderation archive / unarchive

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { prisma } from "@/lib/db.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const { id } = await params;
  const classroom = await prisma.classroom.findUnique({ where: { id }, select: { id: true, name: true, archivedAt: true } });
  if (!classroom) return jsonError(404, "Sınıf bulunamadı.");

  const body = await request.json().catch(() => null);
  const shouldArchive = body?.archive !== undefined ? Boolean(body.archive) : classroom.archivedAt === null;

  const updated = await prisma.classroom.update({
    where: { id },
    data: { archivedAt: shouldArchive ? new Date() : null },
    select: { id: true, name: true, archivedAt: true },
  });

  await recordAuditLog({
    adminId: admin.id,
    action: shouldArchive ? "CLASSROOM_ARCHIVE" : "CLASSROOM_UNARCHIVE",
    entityType: "Classroom",
    entityId: classroom.id,
    metadata: { name: classroom.name, archived: shouldArchive },
  });

  return NextResponse.json({ ok: true, data: updated });
}
