"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/assignments/format.ts";

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  disabledAt: string | Date | null;
  createdAt: string | Date;
  googleSub?: string | null;
  passwordHash?: string | null;
  _count: {
    classrooms: number;
    memberships: number;
    studentAssignments: number;
  };
}

export function UsersManager({ initialUsers, defaultRoleFilter }: { initialUsers: UserItem[]; defaultRoleFilter?: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(defaultRoleFilter ?? "ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confirmUser, setConfirmUser] = useState<UserItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.isActive) ||
        (statusFilter === "DISABLED" && !u.isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function toggleStatus(user: UserItem) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İşlem başarısız oldu.");
      } else {
        setUsers((prev) =>
          prev.map((item) => (item.id === user.id ? { ...item, isActive: !user.isActive } : item))
        );
        setConfirmUser(null);
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Filter and Search Bar */}
      <div
        className="editorial-panel"
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
          padding: "14px 16px",
          background: "#ffffff",
        }}
      >
        <input
          type="text"
          placeholder="İsim veya e-posta ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240, flex: 1 }}
        />

        {!defaultRoleFilter && (
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">Tüm Roller</option>
            <option value="TEACHER">Öğretmenler</option>
            <option value="STUDENT">Öğrenciler</option>
            <option value="ADMIN">Yöneticiler</option>
          </select>
        )}

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Tüm Durumlar</option>
          <option value="ACTIVE">Yalnızca Aktif</option>
          <option value="DISABLED">Devre Dışı</option>
        </select>

        <span className="badge" style={{ marginLeft: "auto", background: "var(--surface-subtle)" }}>
          {filtered.length} kullanıcı listelendi
        </span>
      </div>

      {/* Users Table */}
      <div className="editorial-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Giriş Metodu</th>
                <th>İlişkiler</th>
                <th>Kayıt Tarihi</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    Filtrelere uygun kullanıcı bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: u.role === "ADMIN" ? "#fee2e2" : u.role === "TEACHER" ? "var(--accent-light)" : "var(--ok-bg)",
                          color: u.role === "ADMIN" ? "#991b1b" : u.role === "TEACHER" ? "var(--accent)" : "var(--ok-text)",
                          borderColor: u.role === "ADMIN" ? "#fecaca" : u.role === "TEACHER" ? "var(--accent-border)" : "var(--ok-border)",
                        }}
                      >
                        {u.role === "ADMIN" ? "Admin" : u.role === "TEACHER" ? "Öğretmen" : "Öğrenci"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                        {u.googleSub ? "Google OAuth" : "E-posta / Şifre"}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem" }}>
                        {u.role === "TEACHER"
                          ? `${u._count.classrooms} sınıf`
                          : `${u._count.memberships} sınıf · ${u._count.studentAssignments} görev`}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: u.isActive ? "var(--ok-bg)" : "var(--danger-bg)",
                          color: u.isActive ? "var(--ok-text)" : "var(--danger-text)",
                          borderColor: u.isActive ? "var(--ok-border)" : "var(--danger-border)",
                        }}
                      >
                        {u.isActive ? "Aktif" : "Devre Dışı"}
                      </span>
                    </td>
                    <td>
                      {u.role !== "ADMIN" && (
                        <button
                          type="button"
                          onClick={() => setConfirmUser(u)}
                          className="button"
                          style={{
                            minHeight: 28,
                            padding: "2px 8px",
                            fontSize: "0.78rem",
                            color: u.isActive ? "var(--danger)" : "var(--ok-text)",
                          }}
                        >
                          {u.isActive ? "Devre Dışı Bırak" : "Aktifleştir"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmUser && (
        <div className="modal-backdrop" onClick={() => setConfirmUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>
              {confirmUser.isActive ? "Kullanıcıyı Devre Dışı Bırak" : "Kullanıcıyı Aktifleştir"}
            </h2>
            <p style={{ fontSize: "0.95rem" }}>
              <strong>{confirmUser.name}</strong> ({confirmUser.email}) isimli hesabı{" "}
              {confirmUser.isActive ? "devre dışı bırakmak istediğinizden emin misiniz?" : "tekrar aktif hale getirmek istiyor musunuz?"}
            </p>
            {confirmUser.isActive && (
              <p className="muted" style={{ fontSize: "0.88rem" }}>
                Kullanıcı oturum açamayacak ancak sınıfları, görevleri ve öğrenci geçmişleri veri bütünlüğü için korunacaktır.
              </p>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setConfirmUser(null)} className="button">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(confirmUser)}
                disabled={busy}
                className={`button ${confirmUser.isActive ? "danger" : "primary"}`}
              >
                {busy ? "İşleniyor..." : confirmUser.isActive ? "Evet, Devre Dışı Bırak" : "Evet, Aktifleştir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
