import { NextResponse } from "next/server";
import { authenticate } from "@/lib/accounts/account-service.ts";
import { setSessionCookie } from "@/lib/auth/current-user.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { rateLimit, clientKey } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  try {
    if (!rateLimit(`login:${clientKey(request)}`, 20, 10 * 60_000)) {
      return jsonError(429, "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
    }
    const body = await request.json().catch(() => null);
    if (!body?.email || !body?.password) return jsonError(400, "E-posta ve şifre gerekli.");
    const user = await authenticate(body);
    if (!user) return jsonError(401, "E-posta veya şifre hatalı.");
    return setSessionCookie(NextResponse.json({ ok: true, role: user.role }), user);
  } catch (err) {
    console.error("[auth:login] error:", err);
    return jsonError(500, "Giriş işlemi sırasında sunucu hatası oluştu. Lütfen tekrar deneyin.");
  }
}
