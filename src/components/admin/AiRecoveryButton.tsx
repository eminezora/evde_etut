"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AiRecoveryButton() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function handleRecover() {
    setBusy(true);
    setResultMsg(null);
    try {
      const res = await fetch("/api/admin/ai/recover", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResultMsg(data.message || "Kurtarma işlemi tamamlandı.");
        setModalOpen(false);
        router.refresh();
      } else {
        setResultMsg("Kurtarma sırasında bir hata oluştu.");
      }
    } catch {
      setResultMsg("Sunucuya bağlanılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResultMsg(null);
          setModalOpen(true);
        }}
        className="button primary"
        style={{ minHeight: 36, fontSize: "0.88rem" }}
      >
        ⚡ Takılı Kalan İstekleri Kurtar
      </button>

      {resultMsg && <div className="notice-inline ok" style={{ marginTop: 12 }}>{resultMsg}</div>}

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Stale Generation Kurtarma</h2>
            <p style={{ fontSize: "0.95rem" }}>
              Veritabanında 105 saniyeden daha uzun süredir &ldquo;RUNNING&rdquo; durumunda takılı kalmış olan tüm arka plan içerik oluşturma logları güvenli şekilde &ldquo;TIMEOUT&rdquo; durumuna geçirilecektir.
            </p>
            <div className="info" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              💡 Bu işlem hiçbir görevi veya öğrenci çalışmasını silmez; yalnızca takılı kalmış askıda logları temizler ve öğretmenlerin yeni istek yapmasını sağlar.
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setModalOpen(false)} className="button">
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleRecover}
                disabled={busy}
                className="button primary"
              >
                {busy ? "Kurtarılıyor..." : "Onayla ve Kurtar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
