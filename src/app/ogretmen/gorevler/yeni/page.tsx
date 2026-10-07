import Link from "next/link";
import { requireTeacher } from "@/lib/auth/current-user.ts";
import { prisma } from "@/lib/db.ts";
import { AssignmentWizard } from "@/components/AssignmentWizard.tsx";

export default async function NewAssignmentPage() {
  const teacher = await requireTeacher();
  // Only the teacher's own classrooms; curriculum options are fetched per step.
  const classrooms = await prisma.classroom.findMany({
    where: { teacherId: teacher.id },
    select: { id: true, name: true, grade: true },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  return (
    <>
      <h1>Yeni görev</h1>
      {classrooms.length === 0 ? (
        <div className="card"><p>Görev oluşturmak için önce bir sınıf oluşturun. <Link href="/ogretmen/siniflar">Sınıflarım →</Link></p></div>
      ) : (
        <AssignmentWizard classrooms={classrooms} />
      )}
    </>
  );
}
