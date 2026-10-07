// GET /api/auth/google – start "Google ile devam et": redirect to Google with state, nonce and PKCE.
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, googleConfig, randomToken } from "@/lib/auth/google.ts";
import { signFlowToken } from "@/lib/auth/session.ts";
import { appBaseUrl } from "@/lib/mail/mail-service.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

const GOOGLE_STATE_COOKIE = "g_oauth";

export async function GET(request: Request) {
  const base = appBaseUrl(process.env, new URL(request.url).origin);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${base}/giris?hata=google-kapali`);
  if (!rateLimit(`google:${clientKey(request)}`, 30, 10 * 60_000)) return NextResponse.redirect(`${base}/giris?hata=cok-deneme`);
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const res = NextResponse.redirect(buildGoogleAuthUrl({ clientId: cfg.clientId, redirectUri: `${base}/api/auth/google/callback`, state, nonce, verifier }));
  res.cookies.set(GOOGLE_STATE_COOKIE, await signFlowToken("google-oauth", { state, nonce, verifier }, 600), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
