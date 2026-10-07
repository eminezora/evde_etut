import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db.ts";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth/session.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "E-posta ve şifre gerekli.");
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return jsonError(401, "E-posta veya şifre hatalı.");
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: user.id, role: user.role }), sessionCookieOptions);
  return res;
}
