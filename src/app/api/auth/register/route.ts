// POST /api/auth/register – create an account and sign in.
import { NextResponse } from "next/server";
import { registerUser } from "@/lib/accounts/account-service.ts";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth/session.ts";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const r = await registerUser(body);
    if (!r.ok) return NextResponse.json({ error: r.message, code: r.code }, { status: r.status });
    const res = NextResponse.json({ ok: true, role: r.data.role }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: r.data.id, role: r.data.role }), sessionCookieOptions);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kayıt işlemi sırasında bir hata oluştu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
