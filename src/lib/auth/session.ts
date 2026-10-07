// Signed session cookie (HS256 JWT). Pure helpers – no Next.js imports, so they are testable.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (at least 32 characters).");
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  userId: string;
  role: string;
  /** User.sessionVersion when the session was issued; a password change invalidates older sessions. */
  sessionVersion?: number;
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, sv: payload.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string" || payload.purpose) return null;
    return { userId: payload.sub, role: payload.role, sessionVersion: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

/** Short-lived signed data for multi-step flows (OAuth state, pending Google sign-up). Never a session. */
export async function signFlowToken(purpose: string, data: Record<string, unknown>, maxAgeSeconds: number) {
  return new SignJWT({ ...data, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret());
}

export async function readFlowToken<T extends Record<string, unknown>>(purpose: string, token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.purpose === purpose ? (payload as unknown as T) : null;
  } catch {
    return null;
  }
}
