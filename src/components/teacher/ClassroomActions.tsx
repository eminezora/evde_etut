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
  const isEmpty = studentCount === 0 && assignmentCount === 0;

  const [editOpen, setEditOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  async function handleArchive() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}/archive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sınıf arşivlenirken bir hata oluştu.");
      } else {
        setSuccess("Sınıf başarıyla arşivlendi.");
        setArchiveOpen(false);
        router.refresh();
      }
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleHardDelete() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/classrooms/${classroom.id}?action=delete`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sınıf silinirken bir hata oluştu.");
      } else {
        setDeleteOpen(false);
        router.replace("/ogretmen/siniflar");
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

  return (
    <div>
      {error && (
        <div className="notice-inline error" style={{ marginBottom: 12 }} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice-inline ok" style={{ marginBottom: 12 }} role="status">
          {success}
        </div>
      )}

      {/* Aksiyon Butonları Grubu */}
      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {/* Sınıfı Düzenle */}
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

        {/* Katılım Kodunu Yenile */}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRegenOpen(true);
          }}
          className="button"
          style={{ minHeight: 34, fontSize: "0.88rem" }}
        >
          🔄 Kodu Yenile
        </button>

        {/* Aktif Sınıf Aksiyonları */}
        {!isArchived && (
          <>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setArchiveOpen(true);
              }}
              className="button"
              style={{
                minHeight: 34,
                fontSize: "0.88rem",
                color: "var(--amber-text, #b45309)",
                borderColor: "var(--amber-border, #fde68a)",
                backgroundColor: "var(--amber-bg, #fffbeb)",
              }}
            >
              📦 Sınıfı Arşivle
            </button>

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
                color: "var(--crimson, #dc2626)",
                borderColor: "var(--crimson-border, #fecaca)",
                backgroundColor: "var(--crimson-bg, #fef2f2)",
              }}
            >
              🗑️ Sınıfı Sil
            </button>
          </>
        )}

        {/* Arşivlenmiş Sınıf Aksiyonları */}
        {isArchived && (
          <>
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy}
              className="button primary"
              style={{ minHeight: 34, fontSize: "0.88rem" }}
            >
              {busy ? "İşleniyor..." : "✨ Tekrar Aktif Et"}
            </button>

            {isEmpty && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDeleteOpen(true);
                }}
                className="button danger"
                style={{ minHeight: 34, fontSize: "0.88rem" }}
              >
                🗑️ Kalıcı Olarak Sil
              </button>
            )}
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* 1. DÜZENLEME MODAL                                                */}
      {/* ================================================================= */}
      {editOpen && (
        <div className="modal-backdrop" onClick={() => setEditOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: "1.2rem" }}>Sınıfı Düzenle</h2>
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="edit-class-name">Sınıf / Şube Adı</label>
                <input
                  id="edit-class-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={40}
                  placeholder="Örn: 7/A veya 8-B Fen"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label htmlFor="edit-class-grade">Sınıf Kademesi</label>
                <select
                  id="edit-class-grade"
                  value={grade}
                  disabled={assignmentCount > 0}
                  onChange={(e) => setGrade(Number(e.target.value))}
                >
                  <option value={5}>5. Sınıf</option>
                  <option value={6}>6. Sınıf</option>
                  <option value={7}>7. Sınıf</option>
                  <option value={8}>8. Sınıf</option>
                </select>
                {assignmentCount > 0 && (
                  <p className="muted" style={{ fontSize: "0.82rem", marginTop: 6, color: "var(--amber-text, #b45309)" }}>
                    ⚠️ Bu sınıfa atanmış {assignmentCount} adet görev bulunmaktadır. Müfredat ve kazanım bütünlüğünü korumak için kademe değişikliğine izin verilmez.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label htmlFor="edit-class-desc">Açıklama (İsteğe bağlı)</label>
                <textarea
                  id="edit-class-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Örn: 2026 Bahar Dönemi Matematik Şubesi"
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setEditOpen(false)} className="button">
                  Vazgeç
                </button>
                <button type="submit" disabled={busy} className="button primary">
                  {busy ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. KATILIM KODU YENİLEME MODAL                                   */}
      {/* ================================================================= */}
      {regenOpen && (
        <div className="modal-backdrop" onClick={() => setRegenOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Katılım Kodunu Yenile</h2>
            <p style={{ fontSize: "0.95rem", margin: "0 0 8px" }}>
              Mevcut katılım kodu: <span className="code" style={{ fontSize: "1.05rem", fontWeight: 700 }}>{classroom.joinCode}</span>
            </p>
            <p className="muted" style={{ fontSize: "0.9rem", margin: "8px 0 10px" }}>
              Katılım kodunu yenilediğinizde:
            </p>
            <ul style={{ fontSize: "0.88rem", paddingLeft: 20, color: "var(--text)", lineHeight: 1.6, margin: "0 0 16px" }}>
              <li>Eski kod hemen geçersiz olur.</li>
              <li>Mevcut kayıtlı öğrenciler sınıftan <strong>çıkarılmaz</strong>.</li>
              <li>Yalnızca sınıfa yeni katılacak öğrenciler yeni kodu kullanacaktır.</li>
            </ul>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setRegenOpen(false)} className="button">
                Vazgeç
              </button>
              <button type="button" onClick={handleRegenerateCode} disabled={busy} className="button primary">
                {busy ? "Yenileniyor..." : "Evet, Kodu Yenile"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. SINIFI ARŞİVLE MODAL                                           */}
      {/* ================================================================= */}
      {archiveOpen && (
        <div className="modal-backdrop" onClick={() => setArchiveOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: "1.4rem" }}>📦</span>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Sınıfı Arşivle</h2>
            </div>
            <p style={{ fontSize: "0.95rem", color: "var(--text)", margin: "0 0 12px" }}>
              <strong>{classroom.name}</strong> şubesini arşivlemek istediğinizden emin misiniz?
            </p>
            <div
              style={{
                backgroundColor: "var(--amber-bg, #fffbeb)",
                border: "1px solid var(--amber-border, #fde68a)",
                borderRadius: "var(--radius-sm, 8px)",
                padding: "12px 14px",
                fontSize: "0.88rem",
                color: "var(--amber-text, #92400e)",
                lineHeight: 1.55,
                marginBottom: 16,
              }}
            >
              <strong>Geçmiş Verileriniz Güvende:</strong>
              <p style={{ margin: "4px 0 0" }}>
                Sınıftaki {studentCount} öğrencinin geçmiş çalışma kayıtları, tamamlanan hazırlık görevleri ({assignmentCount} görev) ve değerlendirme raporları asla silinmez. Sınıf aktif listenizden kaldırılarak arşive taşınır. Dilediğiniz an &ldquo;Tekrar Aktif Et&rdquo; seçeneğiyle geri açabilirsiniz.
              </p>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setArchiveOpen(false)} className="button">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={busy}
                className="button"
                style={{
                  backgroundColor: "var(--amber-text, #b45309)",
                  color: "#ffffff",
                  borderColor: "var(--amber-text, #b45309)",
                }}
              >
                {busy ? "Arşivleniyor..." : "Evet, Sınıfı Arşivle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. SİLME ONAY / ENGEL MODAL                                       */}
      {/* ================================================================= */}
      {deleteOpen && (
        <div className="modal-backdrop" onClick={() => setDeleteOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            {isEmpty ? (
              /* Güvenli Boş Sınıf: Kalıcı Hard Delete */
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: "1.4rem" }}>⚠️</span>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--crimson, #dc2626)" }}>
                    Sınıfı Kalıcı Olarak Sil
                  </h2>
                </div>
                <p style={{ fontSize: "0.95rem", color: "var(--text)", lineHeight: 1.5, margin: "0 0 12px" }}>
                  Bu sınıfta hiçbir kayıtlı öğrenci veya verilmiş görev bulunmuyor.
                </p>
                <div
                  style={{
                    backgroundColor: "var(--crimson-bg, #fef2f2)",
                    border: "1px solid var(--crimson-border, #fecaca)",
                    borderRadius: "var(--radius-sm, 8px)",
                    padding: "12px 14px",
                    fontSize: "0.9rem",
                    color: "var(--crimson-text, #991b1b)",
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}
                >
                  <strong>Bu sınıf kalıcı olarak silinecek.</strong> Devam etmek istiyor musunuz?
                </div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setDeleteOpen(false)} className="button">
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleHardDelete}
                    disabled={busy}
                    className="button danger"
                  >
                    {busy ? "Siliniyor..." : "Evet, Kalıcı Olarak Sil"}
                  </button>
                </div>
              </>
            ) : (
              /* Veri Olan Sınıf: Hard Delete Engeli ve Arşivleme Önerisi */
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: "1.4rem" }}>🛡️</span>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)" }}>
                    Sınıf Kalıcı Olarak Silinemez
                  </h2>
                </div>
                <div
                  style={{
                    backgroundColor: "var(--surface-subtle, #f8fafc)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm, 8px)",
                    padding: "14px 16px",
                    fontSize: "0.92rem",
                    color: "var(--text)",
                    lineHeight: 1.6,
                    marginBottom: 16,
                  }}
                >
                  <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--crimson, #dc2626)" }}>
                    Bu sınıfta öğrenci ({studentCount}) veya geçmiş çalışma verileri ({assignmentCount} görev) bulunduğu için kalıcı olarak silinemez.
                  </p>
                  <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    Öğrencilerinizin geçmiş soru cevaplarını, karnelerini ve derse hazırlık başarı raporlarını korumak adına sınıfı arşivleyebilirsiniz.
                  </p>
                </div>
                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setDeleteOpen(false)} className="button">
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteOpen(false);
                      setArchiveOpen(true);
                    }}
                    className="button"
                    style={{
                      backgroundColor: "var(--amber-text, #b45309)",
                      color: "#ffffff",
                      borderColor: "var(--amber-text, #b45309)",
                    }}
                  >
                    📦 Sınıfı Arşivle
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
