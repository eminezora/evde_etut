// "Google ile devam et" (OpenID Connect, authorization code flow with PKCE, state and nonce).
// Configuration: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (env only). Redirect URI:
// <APP_URL>/api/auth/google/callback – it must be registered in the Google Cloud console.
//
// Account rules:
//   - an account already linked to this Google id signs in;
//   - otherwise an account with the same, Google-verified e-mail is linked and signs in
//     (no duplicate users; unverified Google e-mails are never linked);
//   - otherwise nothing is created yet: the person chooses "Öğrenciyim" / "Öğretmenim" first,
//     and a teacher still needs the TEACHER_SIGNUP_CODE invite code.

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma as defaultPrisma } from "../db.ts";
import { checkTeacherCode } from "../accounts/account-service.ts";

export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const isGoogleConfigured = (env: NodeJS.ProcessEnv = process.env) => googleConfig(env) !== null;

export const randomToken = () => randomBytes(32).toString("base64url");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function buildGoogleAuthUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; verifier: string }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: pkceChallenge(p.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/** Exchange the authorization code and verify the ID token (signature, issuer, audience, expiry, nonce). */
export async function exchangeGoogleCode(
  p: { code: string; verifier: string; redirectUri: string; nonce: string },
  cfg: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: p.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code",
      code_verifier: p.verifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (HTTP ${res.status})`);
  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google response has no id_token");
  const { payload } = await jwtVerify(body.id_token, googleKeys, { issuer: GOOGLE_ISSUERS, audience: cfg.clientId });
  return identityFromClaims(payload, p.nonce);
}

export function identityFromClaims(payload: JWTPayload & Record<string, unknown>, expectedNonce: string): GoogleIdentity {
  if (payload.nonce !== expectedNonce) throw new Error("Google nonce mismatch");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("Google identity incomplete");
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 80) : payload.email.split("@")[0],
    picture: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : null,
  };
}

type SessionUser = { id: string; role: string; sessionVersion: number };
export type GoogleLoginResult =
  | { kind: "login"; user: SessionUser; linked: boolean }
  | { kind: "signup"; identity: GoogleIdentity }
  | { kind: "error"; message: string };

const sessionSelect = { id: true, role: true, sessionVersion: true, googleSub: true, avatarUrl: true } as const;

/** Decide what a verified Google identity means for this app (see the rules at the top). */
export async function resolveGoogleLogin(identity: GoogleIdentity, db: PrismaClient = defaultPrisma): Promise<GoogleLoginResult> {
  if (!identity.emailVerified) return { kind: "error", message: "Google hesabınızın e-posta adresi doğrulanmamış. Lütfen e-posta ve şifre ile devam edin." };
  const bySub = await db.user.findUnique({ where: { googleSub: identity.sub }, select: sessionSelect });
  if (bySub) return { kind: "login", user: bySub, linked: false };

  const byEmail = await db.user.findUnique({ where: { email: identity.email }, select: sessionSelect });
  if (byEmail) {
    // The e-mail already belongs to a different Google account: never re-link silently.
    if (byEmail.googleSub && byEmail.googleSub !== identity.sub) return { kind: "error", message: "Bu e-posta adresi başka bir Google hesabına bağlı." };
    const user = await db.user.update({
      where: { id: byEmail.id },
      data: { googleSub: identity.sub, avatarUrl: byEmail.avatarUrl ?? identity.picture },
      select: sessionSelect,
    });
    return { kind: "login", user, linked: true };
  }
  return { kind: "signup", identity };
}

const completeSchema = z.object({
  role: z.enum(["TEACHER", "STUDENT"], { error: "Lütfen öğrenci veya öğretmen olduğunuzu seçin." }),
  teacherCode: z.string().max(200).optional(),
});

/** Create the account for a first-time Google sign-in after the role choice. No password, no classroom. */
export async function completeGoogleSignup(identity: GoogleIdentity, input: unknown, env: NodeJS.ProcessEnv = process.env, db: PrismaClient = defaultPrisma) {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400, message: parsed.error.issues[0].message };
  if (!identity.emailVerified) return { ok: false as const, status: 400, message: "Google e-posta adresi doğrulanmamış." };
  if (parsed.data.role === "TEACHER") {
    const bad = checkTeacherCode(parsed.data.teacherCode, env);
    if (bad) return { ok: false as const, status: bad.status, message: bad.message };
  }
  // Someone may have registered (or linked) meanwhile: fall back to the normal linking rules.
  const again = await resolveGoogleLogin(identity, db);
  if (again.kind === "login") return { ok: true as const, data: again.user };
  if (again.kind === "error") return { ok: false as const, status: 409, message: again.message };
  try {
    const user = await db.user.create({
      data: { email: identity.email, name: identity.name, role: parsed.data.role, googleSub: identity.sub, avatarUrl: identity.picture, passwordHash: null },
      select: { id: true, role: true, sessionVersion: true },
    });
    return { ok: true as const, data: user };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false as const, status: 409, message: "Bu hesap zaten oluşturulmuş. Lütfen tekrar giriş yapın." };
    throw e;
  }
}
