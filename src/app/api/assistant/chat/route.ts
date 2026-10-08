// POST /api/assistant/chat – AI / contextual chatbot route for Etüt Asistan

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { chatWithAssistant } from "@/lib/assistant/assistant-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message : "";
    if (!message.trim()) {
      return jsonError(400, "Mesaj boş olamaz.");
    }

    const user = await getCurrentUser();
    const context = {
      path: typeof body?.context?.path === "string" ? body.context.path : "/",
      role: user?.role ?? "GUEST",
      userName: user?.name,
    };

    const reply = await chatWithAssistant(message, context);
    return NextResponse.json({ ok: true, message: reply });
  } catch (err) {
    console.error("[assistant:chat] error:", err);
    return NextResponse.json({
      ok: true,
      message: "Şu anda yanıt verirken bir aksaklık oldu. Lütfen sorunuzu tekrar yazmayı deneyin.",
    });
  }
}
