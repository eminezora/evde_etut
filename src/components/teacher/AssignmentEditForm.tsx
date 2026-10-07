"use client";

// "Görevi Düzenle": title, deadline (Türkiye date + time), success threshold, question count.
// Locked fields are shown disabled with the reason; the server enforces the same rules.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeadlinePicker } from "../DeadlinePicker.tsx";

export function AssignmentEditForm({
  assignmentId,
  initial,
  started,
  isDraft,
  minScoreLockedMessage,
  questionCountLockedMessage,
}: {
  assignmentId: string;
  initial: { topic: string; deadline: string; minimumScore: number; questionCount: number };
  started: boolean;
  isDraft: boolean;
  minScoreLockedMessage: string;
  questionCountLockedMessage: string;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState(initial.topic);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [minimumScore, setMinimumScore] = useState(String(initial.minimumScore));
  const [questionCount, setQuestionCount] = useState(String(initial.questionCount));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const err = (k: string) => errors[k]?.map((m) => <p key={m} className="error" role="alert">{m}</p>);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setOk(false);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, deadline, minimumScore, ...(isDraft ? { questionCount } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setErrors(json?.errors ?? { _form: [json?.error ?? "Kaydedilemedi."] });
      setOk(true);
      router.refresh();
    } catch {
      setErrors({ _form: ["Sunucuya ulaşılamadı."] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Görev Bilgileri</h2>
      <label htmlFor="topic">Görev Başlığı / Konu</label>
      <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} required />
      {err("topic")}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div>
          <label htmlFor="minimumScore">Derse Hazır Olma Eşiği (%)</label>
          <input id="minimumScore" type="number" min={0} max={100} value={minimumScore} onChange={(e) => setMinimumScore(e.target.value)} disabled={started} />
          {started && <p className="muted" style={{ fontSize: "0.82rem", margin: "6px 0 0" }}>🔒 {minScoreLockedMessage}</p>}
          {err("minimumScore")}
        </div>
        <div>
          <label htmlFor="questionCount">Yapay Zekâ Taslağı Soru Sayısı</label>
          <input id="questionCount" type="number" min={5} max={10} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} disabled={!isDraft} />
          {!isDraft && <p className="muted" style={{ fontSize: "0.82rem", margin: "6px 0 0" }}>🔒 {questionCountLockedMessage}</p>}
          {err("questionCount")}
        </div>
      </div>

      <DeadlinePicker initialIso={initial.deadline} onChange={setDeadline} error={err("deadline")} />

      {err("_form")}
      {ok && <p className="notice-inline ok" role="status" style={{ marginTop: 14 }}>Değişiklikler kaydedildi.</p>}
      <button type="submit" className="primary" disabled={busy} style={{ marginTop: 16 }}>{busy ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</button>
    </form>
  );
}
