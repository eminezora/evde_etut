"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/assignments/format.ts";

export interface AssignmentAdminItem {
  id: string;
  topic: string;
  subject: string;
  grade: number;
  status: string;
  archivedAt: string | Date | null;
  createdAt: string | Date;
  deadline: string | Date;
  teacher: { id: string; name: string; email: string };
  classroom: { id: string; name: string };
  _count: { questions: number; studentAssignments: number };
}

export function AssignmentsAdminManager({ initialAssignments }: { initialAssignments: AssignmentAdminItem[] }) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentAdminItem[]>(initialAssignments);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive(item: AssignmentAdminItem) {
    setBusy(true);
    setError(null);
    const shouldArchive = item.archivedAt === null;

    try {
      const res = await fetch(`/api/admin/assignments/${item.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: shouldArchive }),
      });
      if (res.ok) {
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === item.id ? { ...a, archivedAt: shouldArchive ? new Date() : null } : a
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

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Görev Konusu</th>
                <th>Ders</th>
                <th>Kademe</th>
                <th>Öğretmen</th>
                <th>Sınıf</th>
                <th>Soru</th>
                <th>Yayın Durumu</th>
                <th>Arşiv</th>
                <th>Moderasyon</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Henüz oluşturulmuş görev bulunmuyor.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => {
                  const isArchived = Boolean(a.archivedAt);
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.topic}</strong>
                        <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>{formatDate(a.createdAt)}</span>
                      </td>
                      <td>{a.subject}</td>
                      <td>
                        <span className="badge">{a.grade}. sınıf</span>
                      </td>
                      <td>
                        <span>{a.teacher.name}</span>
                        <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>{a.teacher.email}</span>
                      </td>
                      <td>{a.classroom.name}</td>
                      <td>{a._count.questions} soru</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: a.status === "PUBLISHED" ? "var(--ok-bg)" : "var(--warn-bg)",
                            color: a.status === "PUBLISHED" ? "var(--ok-text)" : "var(--warn-text)",
                            borderColor: a.status === "PUBLISHED" ? "var(--ok-border)" : "var(--warn-border)",
                          }}
                        >
                          {a.status === "PUBLISHED" ? "Yayında" : "Taslak"}
                        </span>
                      </td>
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
                          onClick={() => toggleArchive(a)}
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
