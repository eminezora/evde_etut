"use client";

// "Görevi Düzenle" / "Görevi Sil" (with a confirmation dialog) / "Arşivden Çıkar".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AssignmentActions({ assignmentId, archived, willArchive }: { assignmentId: string; archived: boolean; willArchive: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function call(url: string, method: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "İşlem yapılamadı.");
      return json?.data as { action?: string };
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem yapılamadı.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const data = await call(`/api/assignments/${assignmentId}`, "DELETE");
    if (!data) return;
    setOpen(false);
    if (data.action === "DELETED") router.replace("/ogretmen/gorevler?silindi=1");
    else router.refresh();
  }

  if (archived) {
    return (
      <div className="row">
        <button type="button" onClick={async () => (await call(`/api/assignments/${assignmentId}/restore`, "POST")) && router.refresh()} disabled={busy}>
          {busy ? "…" : "Arşivden Çıkar"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <Link href={`/ogretmen/gorevler/${assignmentId}/duzenle`} className="button">
          Görevi Düzenle
        </Link>
        <button type="button" className="danger-ghost" onClick={() => { setError(null); setOpen(true); }}>
          Görevi Sil / Arşivle
        </button>
      </div>
      <dialog ref={dialog} className="modal" aria-labelledby="delete-title" onClose={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <h2 id="delete-title" style={{ marginTop: 0 }}>Bu görevi silmek istediğinize emin misiniz?</h2>
        {willArchive ? (
          <p className="muted">
            Bu görev yayınlandı veya öğrenciler tarafından açıldı. Öğrenci cevapları ve raporlar korunsun diye görev <strong>kalıcı olarak silinmez, arşivlenir</strong>: listenizde ve öğrencilerin ekranında görünmez, istediğiniz zaman arşivden çıkarabilirsiniz.
          </p>
        ) : (
          <p className="muted">Bu taslak görev ve hazırlık içeriği/soruları <strong>kalıcı olarak silinecek</strong>. Bu işlem geri alınamaz.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={busy} autoFocus>Vazgeç</button>
          <button type="button" className="danger" onClick={confirmDelete} disabled={busy}>{busy ? "İşleniyor…" : willArchive ? "Arşivle" : "Kalıcı Olarak Sil"}</button>
        </div>
      </dialog>
    </>
  );
}
