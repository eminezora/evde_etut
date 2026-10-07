import { requireTeacher } from "@/lib/auth/current-user.ts";
import { listTeacherClassrooms } from "@/lib/accounts/account-service.ts";
import { CreateClassroomForm } from "@/components/teacher/CreateClassroomForm.tsx";

export default async function ClassroomsPage() {
  const teacher = await requireTeacher();
  const classrooms = await listTeacherClassrooms(teacher.id);
  return (
    <>
      <h1>Sınıflarım</h1>
      <div className="card"><CreateClassroomForm /></div>
      <div className="card">
        {classrooms.length === 0 ? (
          <p className="muted">Henüz sınıf yok.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead><tr><th>Sınıf</th><th>Düzey</th><th>Katılma kodu</th><th>Öğrenci</th><th>Görev</th></tr></thead>
            <tbody>
              {classrooms.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.grade}. sınıf</td>
                  <td><span className="code" style={{ display: "inline", letterSpacing: "0.1em" }}>{c.joinCode}</span></td>
                  <td>{c._count.members}</td>
                  <td>{c._count.assignments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <p className="muted">Öğrenciler kayıt olduktan sonra bu kodla sınıfa katılır.</p>
      </div>
    </>
  );
}
