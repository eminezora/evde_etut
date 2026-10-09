// GET/PUT /api/admin/usage/policies – role default quotas (admin only).
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/current-user.ts";
import { recordAuditLog } from "@/lib/admin/audit-service.ts";
import { jsonError } from "@/lib/http/route-helpers.ts";
import { listPolicies, upsertPolicy, validatePolicyInput, type PolicyInput } from "@/lib/usage/usage-quota-service.ts";

export async function GET() {
  if (!(await getCurrentAdmin())) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");
  return NextResponse.json({ ok: true, data: await listPolicies() });
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError(403, "Bu işlemi yalnızca sistem yöneticileri yapabilir.");
  const b = await request.json().catch(() => null);
  const input: PolicyInput = {
    role: String(b?.role ?? ""),
    feature: String(b?.feature ?? ""),
    periodType: String(b?.periodType ?? ""),
    limit: Number(b?.limit),
    unlimited: b?.unlimited === true,
    isActive: b?.isActive !== false,
  };
  const bad = validatePolicyInput(input);
  if (bad) return jsonError(400, bad);
  const saved = await upsertPolicy(input);
  await recordAuditLog({ adminId: admin.id, action: "USAGE_POLICY_UPDATE", entityType: "UsageQuotaPolicy", entityId: saved.id, metadata: { ...input } });
  return NextResponse.json({ ok: true, data: saved });
}
