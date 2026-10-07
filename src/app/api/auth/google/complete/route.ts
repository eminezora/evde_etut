// POST /api/auth/google/complete { role, teacherCode? } – finish a first-time Google sign-up.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeGoogleSignup, type GoogleIdentity } from "@/lib/auth/google.ts";
import { readFlowToken } from "@/lib/auth/session.ts";
import { setSessionCookie } from "@/lib/auth/current-user.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  if (!rateLimit(`google-complete:${clientKey(request)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." }, { status: 429 });
  }
  const identity = await readFlowToken<GoogleIdentity & Record<string, unknown>>("google-signup", (await cookies()).get("g_signup")?.value);
  if (!identity) return NextResponse.json({ error: "Google oturumunun süresi doldu. Lütfen tekrar 'Google ile devam et' seçin." }, { status: 401 });
  const r = await completeGoogleSignup(identity, await request.json().catch(() => null));
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.status });
  const res = NextResponse.json({ ok: true, role: r.data.role }, { status: 201 });
  res.cookies.delete("g_signup");
  return setSessionCookie(res, r.data);
}
