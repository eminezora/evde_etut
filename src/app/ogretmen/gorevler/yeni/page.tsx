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
        <div className="editorial-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem", margin: "0 0 8px" }}>Henüz Tanımlı Bir Sınıfınız Bulunmuyor</h2>
          <p className="muted" style={{ maxWidth: 460, margin: "0 auto 20px", fontSize: "0.95rem", lineHeight: 1.6 }}>
            Öğrencilerinize derse hazırlık görevi atayabilmek için öncelikle en az bir sınıf şubesi oluşturmanız gerekmektedir.
          </p>
          <Link href="/ogretmen/siniflar" className="button primary" style={{ padding: "10px 20px" }}>
            Sınıf Masasına Git ve Şube Oluştur →
          </Link>
        </div>
      ) : (
        <AssignmentWizard classrooms={classrooms} />
      )}
    </>
  );
}
