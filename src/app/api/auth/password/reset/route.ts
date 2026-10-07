// POST /api/auth/password/reset { token, password, passwordConfirm }
import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/accounts/password-service.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  if (!rateLimit(`reset:${clientKey(request)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin." }, { status: 429 });
  }
  const r = await resetPassword(await request.json().catch(() => null));
  if (!r.ok) return NextResponse.json({ error: r.message, code: r.code, errors: { [r.field]: [r.message] } }, { status: r.status });
  return NextResponse.json({ ok: true });
}
