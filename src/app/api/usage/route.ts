// GET /api/usage – the signed-in user's own quotas (and recent usage with ?history=1).
// Never accepts a user id: a user can only ever see their own numbers.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { getUsageSummary, limitReachedMessage, listUsageHistory } from "@/lib/usage/usage-quota-service.ts";
import { toMeterData } from "@/components/usage/UsageMeter.tsx";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Oturum açmanız gerekiyor.");
  // limitMessage: the exact Turkish text the server answers with once this quota is used up.
  const summary = (await getUsageSummary(user)).map((q) => ({ ...toMeterData(q), limitMessage: limitReachedMessage(q.feature, q.periodType, q.periodEnd) }));
  const withHistory = new URL(request.url).searchParams.get("history") === "1";
  return NextResponse.json({ ok: true, data: { quotas: summary, history: withHistory ? await listUsageHistory(user.id) : undefined } });
}
