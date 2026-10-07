// PATCH /api/profile { name } – update the signed-in user's own name.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { updateProfileName } from "@/lib/accounts/profile-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Oturum açmanız gerekiyor.");
  const r = await updateProfileName(user.id, await request.json().catch(() => null));
  if (!r.ok) return jsonError(r.status, r.message);
  return NextResponse.json({ ok: true, data: r.data });
}
