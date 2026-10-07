// POST /api/auth/password/forgot { email } – always answers the same generic message.
// The lookup and e-mail run after the response so timing does not reveal whether the account exists.
import { after, NextResponse } from "next/server";
import { RESET_REQUESTED_MESSAGE, requestPasswordReset } from "@/lib/accounts/password-service.ts";
import { appBaseUrl, getMailProvider } from "@/lib/mail/mail-service.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  if (rateLimit(`forgot:${clientKey(request)}`, 5, 15 * 60_000)) {
    const baseUrl = appBaseUrl(process.env, new URL(request.url).origin);
    after(async () => {
      const r = await requestPasswordReset(email, { mailer: getMailProvider(), baseUrl }).catch(() => ({ sent: false, reason: "ERROR" as const }));
      // Reason only – never the address, token or link.
      if (!r.sent && (r.reason === "MAIL_FAILED" || r.reason === "MAIL_NOT_CONFIGURED" || r.reason === "ERROR")) {
        console.warn(`[password-reset] e-posta gönderilemedi: ${r.reason}`);
      }
    });
  }
  return NextResponse.json({ ok: true, message: RESET_REQUESTED_MESSAGE });
}
