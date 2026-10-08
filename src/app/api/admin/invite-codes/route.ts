// GET & POST /api/admin/invite-codes – Admin management of teacher invite codes

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { createTeacherInvite, listTeacherInvites } from "@/lib/admin/invite-code-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu alana yalnızca sistem yöneticileri erişebilir.");

  const list = await listTeacherInvites();
  return NextResponse.json({ ok: true, data: list });
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const body = await request.json().catch(() => null);
  const maxUses = body?.maxUses ? Number(body.maxUses) : 1;
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;

  const result = await createTeacherInvite(admin.id, { maxUses, expiresAt });
  return result.ok
    ? NextResponse.json({ ok: true, data: result.data }, { status: 201 })
    : jsonError(400, result.message);
}
