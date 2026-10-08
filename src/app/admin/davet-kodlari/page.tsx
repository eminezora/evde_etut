import { requireAdmin } from "@/lib/auth/current-user.ts";
import { listTeacherInvites } from "@/lib/admin/invite-code-service.ts";
import { InviteCodesManager } from "@/components/admin/InviteCodesManager.tsx";

export const metadata = { title: "Öğretmen Davet Kodları – Evde Etüt Admin" };

export default async function AdminInviteCodesPage() {
  await requireAdmin();
  const list = await listTeacherInvites();

  return (
    <div>
      <InviteCodesManager initialCodes={list} />
    </div>
  );
}
