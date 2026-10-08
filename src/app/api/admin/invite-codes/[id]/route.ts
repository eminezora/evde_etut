// PATCH /api/admin/invite-codes/[id] – Toggle teacher invite code active/inactive

import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { setTeacherInviteStatus } from "@/lib/admin/invite-code-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const isActive = Boolean(body?.isActive);

  const result = await setTeacherInviteStatus(admin.id, id, isActive);
  return result.ok
    ? NextResponse.json({ ok: true, data: result.data })
    : jsonError(400, result.message);
}
