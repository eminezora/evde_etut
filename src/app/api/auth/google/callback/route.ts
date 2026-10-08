// GET /api/auth/google/callback – Google redirects here. Verifies state + ID token, then signs in,
// links the account by verified e-mail, or sends a first-time user to the role choice.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCode, googleConfig, resolveGoogleLogin } from "@/lib/auth/google.ts";
import { readFlowToken, signFlowToken } from "@/lib/auth/session.ts";
import { setSessionCookie } from "@/lib/auth/current-user.ts";
import { appBaseUrl } from "@/lib/mail/mail-service.ts";

const GOOGLE_SIGNUP_COOKIE = "g_signup";
const dashboard = (role: string) => (role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/ogretmen/gorevler" : "/ogrenci/gorevler");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = appBaseUrl(process.env, url.origin);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${base}/giris?hata=${code}`);
    res.cookies.delete({ name: "g_oauth", path: "/api/auth/google" });
    return res;
  };
  const cfg = googleConfig();
  if (!cfg) return fail("google-kapali");
  if (url.searchParams.get("error")) return fail("google-iptal");

  const flow = await readFlowToken<{ state: string; nonce: string; verifier: string }>("google-oauth", (await cookies()).get("g_oauth")?.value);
  const code = url.searchParams.get("code");
  if (!flow || !code || url.searchParams.get("state") !== flow.state) return fail("google-hata");

  let identity;
  try {
    identity = await exchangeGoogleCode({ code, verifier: flow.verifier, redirectUri: `${base}/api/auth/google/callback`, nonce: flow.nonce }, cfg);
  } catch {
    return fail("google-hata");
  }
  const result = await resolveGoogleLogin(identity);
  if (result.kind === "error") return fail(identity.emailVerified ? "google-baska-hesap" : "google-dogrulanmamis");
  if (result.kind === "login") {
    const res = NextResponse.redirect(`${base}${dashboard(result.user.role)}`);
    res.cookies.delete({ name: "g_oauth", path: "/api/auth/google" });
    return setSessionCookie(res, result.user);
  }
  // First Google sign-in: no account yet. Keep the verified identity in a short-lived signed cookie.
  const res = NextResponse.redirect(`${base}/kayit/google`);
  res.cookies.delete({ name: "g_oauth", path: "/api/auth/google" });
  res.cookies.set(GOOGLE_SIGNUP_COOKIE, await signFlowToken("google-signup", { ...identity }, 900), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 900,
  });
  return res;
}
