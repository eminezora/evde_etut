// Small in-memory fixed-window rate limiter for abuse-prone endpoints (login, sign-up, password
// reset). Best effort: on serverless each instance keeps its own window, so the password-reset
// flow additionally limits per account in the database.

const windows = new Map<string, { count: number; resetAt: number }>();

/** true when the call is allowed; false when `key` exceeded `limit` calls within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 5000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    return true;
  }
  w.count++;
  return w.count <= limit;
}

/** Client identity for rate limiting (first X-Forwarded-For hop on Vercel). */
export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
