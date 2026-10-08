import { requireAdmin } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { AssignmentsAdminManager } from "@/components/admin/AssignmentsAdminManager.tsx";

export const metadata = { title: "Görev Yönetimi – DersBot Admin" };

export default async function AdminAssignmentsPage() {
  await requireAdmin();

  const assignments = await prisma.assignment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      status: true,
      archivedAt: true,
      createdAt: true,
      deadline: true,
      teacher: { select: { id: true, name: true, email: true } },
      classroom: { select: { id: true, name: true } },
      _count: { select: { questions: true, studentAssignments: true } },
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 700 }}>Tüm Görevler</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Öğretmenlerin oluşturduğu derse hazırlık görevleri, yayın ve arşiv durumları.
        </p>
      </div>

      <AssignmentsAdminManager initialAssignments={assignments} />
    </div>
  );
}
