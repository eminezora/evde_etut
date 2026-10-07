// POST /api/auth/register – create an account and sign in.
import { NextResponse } from "next/server";
import { registerUser } from "@/lib/accounts/account-service.ts";
import { setSessionCookie } from "@/lib/auth/current-user.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  if (!rateLimit(`register:${clientKey(request)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." }, { status: 429 });
  }
  try {
    const body = await request.json().catch(() => null);
    const r = await registerUser(body);
    if (!r.ok) return NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
    return setSessionCookie(NextResponse.json({ ok: true, role: r.data.role }, { status: 201 }), r.data);
  } catch {
    // Never echo internal error details (they can contain database information).
    return NextResponse.json({ error: "Kayıt işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
