"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ClassroomActionsProps {
  classroom: {
    id: string;
    name: string;
    grade: number;
    joinCode: string;
    description?: string | null;
    archivedAt?: string | Date | null;
  };
  studentCount: number;
  assignmentCount: number;
}

export function ClassroomActions({ classroom, studentCount, assignmentCount }: ClassroomActionsProps) {
  const router = useRouter();
  const isArchived = Boolean(classroom.archivedAt);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const [name, setName] = useState(classroom.name);
  const [grade, setGrade] = useState(classroom.grade);
  const [description, setDescription] = useState(classroom.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sınıf güncellenirken bir hata oluştu.");
      } else {
        setSuccess("Sınıf bilgileri başarıyla güncellendi.");
        setEditOpen(false);
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateCode() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}/regenerate-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kod yenilenirken bir hata oluştu.");
      } else {
        setSuccess("Yeni katılma kodu oluşturuldu. Eski kod artık geçersizdir.");
        setRegenOpen(false);
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOrArchive() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "İşlem sırasında bir hata oluştu.");
      } else {
        setDeleteOpen(false);
        if (data.action === "DELETED") {
          router.replace("/ogretmen/siniflar");
        } else {
          setSuccess(data.message || "Sınıf arşivlendi.");
          router.refresh();
        }
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}/restore`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sınıf aktifleştirilirken bir hata oluştu.");
      } else {
        setSuccess("Sınıf tekrar aktif hale getirildi.");
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = studentCount === 0 && assignmentCount === 0;

  return (
    <div style={{ marginBottom: 20 }}>
      {isArchived && (
        <div className="warning-banner" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>⚠️ Bu sınıf arşivlenmiştir.</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>
              Arşivlenmiş sınıflar öğrencilerin aktif listesinde görünmez ve yeni öğrenci katılımı kabul etmez. Raporlar ve geçmiş çalışmalar korunur.
            </p>
          </div>
          <button type="button" onClick={handleRestore} disabled={busy} className="button primary" style={{ minHeight: 36 }}>
            {busy ? "İşleniyor..." : "Sınıfı Tekrar Aktif Et"}
          </button>
        </div>
      )}

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="notice-inline ok" style={{ marginBottom: 12 }}>{success}</div>}

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditOpen(true);
          }}
          className="button"
          style={{ minHeight: 34, fontSize: "0.88rem" }}
        >
          ✏️ Sınıfı Düzenle
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setRegenOpen(true);
          }}
          className="button"
          style={{ minHeight: 34, fontSize: "0.88rem" }}
        >
          🔄 Katılım Kodunu Yenile
        </button>

        {!isArchived && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
            className="button"
            style={{
              minHeight: 34,
              fontSize: "0.88rem",
              color: isEmpty ? "var(--danger)" : "var(--warn-text)",
              borderColor: isEmpty ? "var(--danger-border)" : "var(--warn-border)",
            }}
          >
            {isEmpty ? "🗑️ Sınıfı Sil" : "📦 Sınıfı Arşivle"}
          </button>
        )}
      </div>

      {/* Düzenleme Modal */}
      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Sınıfı Düzenle</h2>
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="edit-class-name">Sınıf / Şube Adı</label>
                <input
                  id="edit-class-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={40}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="edit-class-grade">Sınıf Kademesi</label>
                <select
                  id="edit-class-grade"
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                >
                  <option value={5}>5. Sınıf</option>
                  <option value={6}>6. Sınıf</option>
                  <option value={7}>7. Sınıf</option>
                  <option value={8}>8. Sınıf</option>
                </select>
                {assignmentCount > 0 && (
                  <p className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                    ℹ️ Bu sınıfta mevcut görevler varsa sınıf düzeyi değişikliğine izin verilmez.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="edit-class-desc">Açıklama (İsteğe bağlı)</label>
                <textarea
                  id="edit-class-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Örn: 2026 Bahar Dönemi Matematik Grubu"
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setEditOpen(false)} className="button">
                  Vazgeç
                </button>
                <button type="submit" disabled={busy} className="button primary">
                  {busy ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kod Yenileme Onay Modal */}
      {regenOpen && (
        <div className="modal-backdrop" onClick={() => setRegenOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Katılım Kodunu Yenile</h2>
            <p style={{ fontSize: "0.95rem" }}>
              Mevcut katılım kodu: <span className="code">{classroom.joinCode}</span>
            </p>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Katılım kodunu yenilediğinizde:
            </p>
            <ul style={{ fontSize: "0.88rem", paddingLeft: 20, color: "var(--text)" }}>
              <li>Eski kod hemen geçersiz olur.</li>
              <li>Mevcut öğrenciler sınıftan <strong>çıkarılmaz</strong>.</li>
              <li>Sadece sınıfa yeni katılacak öğrenciler yeni kodu kullanır.</li>
            </ul>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setRegenOpen(false)} className="button">
                İptal
              </button>
              <button type="button" onClick={handleRegenerateCode} disabled={busy} className="button primary">
                {busy ? "Yenileniyor..." : "Evet, Kodu Yenile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silme / Arşivleme Onay Modal */}
      {deleteOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>
              {isEmpty ? "Sınıfı Sil" : "Sınıfı Arşivle"}
            </h2>
            {isEmpty ? (
              <p style={{ fontSize: "0.95rem", color: "var(--text)" }}>
                Bu sınıfta hiçbir kayıtlı öğrenci veya verilmiş görev bulunmuyor. Sınıf kalıcı olarak silinecektir. Emin misiniz?
              </p>
            ) : (
              <div>
                <p style={{ fontSize: "0.95rem", color: "var(--text)" }}>
                  Bu sınıfı arşivlemek istediğinizden emin misiniz?
                </p>
                <div className="info" style={{ marginTop: 8, fontSize: "0.88rem" }}>
                  💡 <strong>Verileriniz Korunur:</strong> Sınıftaki {studentCount} öğrencinin geçmiş çalışma kayıtları, tamamlanan görevler ve başarı raporları silinmez. Sınıf aktif listenizden kaldırılarak arşiv bölümüne taşınır. İleride istediğiniz zaman tekrar aktif edebilirsiniz.
                </div>
              </div>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setDeleteOpen(false)} className="button">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDeleteOrArchive}
                disabled={busy}
                className="button danger"
              >
                {busy ? "İşleniyor..." : isEmpty ? "Evet, Kalıcı Olarak Sil" : "Evet, Sınıfı Arşivle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
