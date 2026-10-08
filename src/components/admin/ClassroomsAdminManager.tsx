"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/assignments/format.ts";

export interface ClassroomAdminItem {
  id: string;
  name: string;
  grade: number;
  joinCode: string;
  description?: string | null;
  archivedAt: string | Date | null;
  createdAt: string | Date;
  teacher: { id: string; name: string; email: string };
  _count: { members: number; assignments: number };
}

export function ClassroomsAdminManager({ initialClassrooms }: { initialClassrooms: ClassroomAdminItem[] }) {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<ClassroomAdminItem[]>(initialClassrooms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive(item: ClassroomAdminItem) {
    setBusy(true);
    setError(null);
    const shouldArchive = item.archivedAt === null;

    try {
      const res = await fetch(`/api/admin/classrooms/${item.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: shouldArchive }),
      });
      if (res.ok) {
        setClassrooms((prev) =>
          prev.map((c) =>
            c.id === item.id ? { ...c, archivedAt: shouldArchive ? new Date() : null } : c
          )
        );
        router.refresh();
      } else {
        setError("İşlem başarısız oldu.");
      }
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sınıf Adı</th>
                <th>Kademe</th>
                <th>Öğretmen</th>
                <th>Katılım Kodu</th>
                <th>Öğrenci Sayısı</th>
                <th>Görev Sayısı</th>
                <th>Oluşturulma</th>
                <th>Durum</th>
                <th>Moderasyon</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Henüz kayıtlı sınıf bulunmuyor.
                  </td>
                </tr>
              ) : (
                classrooms.map((c) => {
                  const isArchived = Boolean(c.archivedAt);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <span className="badge">{c.grade}. sınıf</span>
                      </td>
                      <td>
                        <span>{c.teacher.name}</span>
                        <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>{c.teacher.email}</span>
                      </td>
                      <td>
                        <span className="code">{c.joinCode}</span>
                      </td>
                      <td>{c._count.members} öğrenci</td>
                      <td>{c._count.assignments} görev</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isArchived ? "var(--warn-bg)" : "var(--ok-bg)",
                            color: isArchived ? "var(--warn-text)" : "var(--ok-text)",
                            borderColor: isArchived ? "var(--warn-border)" : "var(--ok-border)",
                          }}
                        >
                          {isArchived ? "Arşivli" : "Aktif"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleArchive(c)}
                          disabled={busy}
                          className="button"
                          style={{
                            minHeight: 28,
                            padding: "2px 8px",
                            fontSize: "0.78rem",
                            color: isArchived ? "var(--ok-text)" : "var(--warn-text)",
                          }}
                        >
                          {isArchived ? "Arşivden Çıkar" : "Arşivle"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
