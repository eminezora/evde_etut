import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { UsersManager } from "@/components/admin/UsersManager.tsx";

export const metadata = { title: "Öğretmenler – Evde Etüt Admin" };

export default async function AdminTeachersPage() {
  await requireAdmin();

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      disabledAt: true,
      createdAt: true,
      googleSub: true,
      _count: {
        select: {
          classrooms: true,
          memberships: true,
          studentAssignments: true,
        },
      },
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Öğretmen Yönetimi</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Sistemde kayıtlı öğretmenlerin hesap durumu, sınıf ve görev etkinlikleri.
        </p>
      </div>

      <UsersManager initialUsers={teachers} defaultRoleFilter="TEACHER" />
    </div>
  );
}
