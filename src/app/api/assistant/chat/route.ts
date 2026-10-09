// POST /api/assistant/chat { message, messageId?, context? } – DersBot assistant.
// Signed-in users: one DersBot quota unit is reserved before EVREN is called and kept only when
// EVREN actually answered (a local fallback answer is free). messageId makes a resent message
// idempotent. Guests only get the local knowledge base (no EVREN cost).
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { chatWithAssistantDetailed } from "@/lib/assistant/assistant-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { commitUsage, refundUsage, reserveUsage } from "@/lib/usage/usage-quota-service.ts";
import { clientKey, rateLimit } from "@/lib/http/rate-limit.ts";

const FEATURE = "AI_ASSISTANT_MESSAGE" as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.slice(0, 2000) : "";
  if (!message.trim()) return jsonError(400, "Mesaj boş olamaz.");
  if (!rateLimit(`assistant:${clientKey(request)}`, 60, 10 * 60_000)) return jsonError(429, "Çok hızlı mesaj gönderiliyor. Lütfen biraz bekleyin.");

  const user = await getCurrentUser();
  const context = {
    path: typeof body?.context?.path === "string" ? body.context.path : "/",
    role: user?.role ?? "GUEST",
    userName: user?.name,
  };
  if (!user) {
    const reply = await chatWithAssistantDetailed(message, context, { allowAi: false });
    return NextResponse.json({ ok: true, message: reply.text });
  }

  const messageId = typeof body?.messageId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.messageId) ? body.messageId : randomUUID();
  const reservation = await reserveUsage(user, FEATURE, `chat:${messageId}`);
  if (!reservation.ok) {
    return NextResponse.json(
      { ok: false, code: reservation.code, error: reservation.message, message: reservation.message, quota: { remaining: 0, limit: reservation.quota.limit, resetHint: reservation.quota.resetHint } },
      { status: 429 },
    );
  }
  try {
    const reply = await chatWithAssistantDetailed(message, context);
    if (reply.source === "ai") await commitUsage(user.id, FEATURE, `chat:${messageId}`);
    else await refundUsage(user.id, FEATURE, `chat:${messageId}`);
    return NextResponse.json({ ok: true, message: reply.text });
  } catch {
    await refundUsage(user.id, FEATURE, `chat:${messageId}`).catch(() => undefined);
    return NextResponse.json({ ok: true, message: "Şu anda yanıt verirken bir aksaklık oldu. Lütfen sorunuzu tekrar yazmayı deneyin." });
  }
}
