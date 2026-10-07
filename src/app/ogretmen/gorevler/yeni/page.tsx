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
      <div style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 6 }}>
          <Link href="/ogretmen/gorevler">← Görevlerime dön</Link>
        </p>
        <h1 style={{ marginBottom: 4 }}>Yeni Hazırlık Görevi Oluştur</h1>
        <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
          Sınıfınızı ve MEB kazanımını seçerek derse hazırlık ödevini adım adım planlayın.
        </p>
      </div>

      {classrooms.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>🏫</span>
          <h2>Henüz Tanımlı Bir Sınıfınız Yok</h2>
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 16px" }}>
            Görev atayabilmek için önce bir sınıf oluşturmanız gerekmektedir.
          </p>
          <Link href="/ogretmen/siniflar" className="button primary">
            Sınıf Oluştur →
          </Link>
        </div>
      ) : (
        <AssignmentWizard classrooms={classrooms} />
      )}
    </>
  );
}
