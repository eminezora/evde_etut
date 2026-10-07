// POST /api/profile/password { currentPassword?, password, passwordConfirm }
// Change the password (current one required) or create one for a Google-only account.
// Other sessions are signed out; this browser gets a fresh session cookie.
import { NextResponse } from "next/server";
import { getCurrentUser, setSessionCookie } from "@/lib/auth/current-user.ts";
import { changePassword } from "@/lib/accounts/password-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { rateLimit } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Oturum açmanız gerekiyor.");
  if (!rateLimit(`password-change:${user.id}`, 10, 15 * 60_000)) return jsonError(429, "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
  const r = await changePassword(user.id, await request.json().catch(() => null));
  if (!r.ok) return jsonError(r.status, r.message, { [r.field]: [r.message] });
  return setSessionCookie(NextResponse.json({ ok: true, created: r.data.created }), r.data);
}
