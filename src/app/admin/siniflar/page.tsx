import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { ClassroomsAdminManager } from "@/components/admin/ClassroomsAdminManager.tsx";

export const metadata = { title: "Sınıf Yönetimi – Evde Etüt Admin" };

export default async function AdminClassroomsPage() {
  await requireAdmin();

  const classrooms = await prisma.classroom.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      grade: true,
      joinCode: true,
      description: true,
      archivedAt: true,
      createdAt: true,
      teacher: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, assignments: true } },
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Tüm Sınıflar</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Sistem genelinde oluşturulmuş sınıflar, öğretmenleri ve moderasyon durumu.
        </p>
      </div>

      <ClassroomsAdminManager initialClassrooms={classrooms} />
    </div>
  );
}
