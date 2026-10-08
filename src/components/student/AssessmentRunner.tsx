"use client";

// One question at a time, mobile-first. Answers are autosaved (debounced, only changed
// questions) and flushed before submitting. Scoring happens on the server only.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QUESTION_TYPE_LABELS, type StudentQuestion } from "@/lib/content/question-schema.ts";
import type { AnswerValue } from "@/lib/assessment/answer-schema.ts";
import { QuestionRenderer, hasAnswer } from "@/components/questions/QuestionRenderer.tsx";

const AUTOSAVE_MS = 1500;

export function AssessmentRunner({
  assignmentId,
  attemptId,
  attemptNumber,
  questions,
  initialAnswers,
}: {
  assignmentId: string;
  attemptId: string;
  attemptNumber: number;
  questions: StudentQuestion[];
  initialAnswers: Record<string, AnswerValue | null>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>(initialAnswers);
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(new Set<string>());
  const latest = useRef(answers);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const ids = [...dirty.current];
    if (!ids.length) return true;
    dirty.current.clear();
    setSaveState("saving");
    const res = await fetch(`/api/student/attempts/${attemptId}/answers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: ids.map((questionId) => ({ questionId, answer: latest.current[questionId] })) }),
    });
    if (!res.ok) {
      ids.forEach((id) => dirty.current.add(id));
      setSaveState("error");
      setError((await res.json().catch(() => null))?.error ?? "Cevaplar kaydedilemedi.");
      return false;
    }
    setSaveState("saved");
    return true;
  }, [attemptId]);

  const change = (questionId: string, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    dirty.current.add(questionId);
    setSaveState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
  };

  // Save before the tab is closed / hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  const unanswered = questions.filter((q) => !hasAnswer(q.type, answers[q.id]));
  const q = questions[index];

  async function submit() {
    if (!(await flush())) return;
    const warn = unanswered.length ? `\n\n${unanswered.length} soruyu henüz cevaplamadın.` : "";
    if (!window.confirm(`Çalışmayı göndermek istediğine emin misin?${warn}\n\nGönderdikten sonra cevaplarını değiştiremezsin.`)) return;
    setSubmitting(true);
    setError(null);
    const answered = questions.filter((x) => hasAnswer(x.type, answers[x.id])).map((x) => ({ questionId: x.id, answer: answers[x.id] }));
    const res = await fetch(`/api/student/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answered }),
    });
    if (!res.ok) {
      setSubmitting(false);
      setError((await res.json().catch(() => null))?.error ?? "Çalışma gönderilemedi.");
      return;
    }
    router.push(`/ogrenci/gorevler/${assignmentId}/sonuc`);
    router.refresh();
  }

  const progressPercent = Math.round(((index + 1) / questions.length) * 100);

  return (
    <div className="editorial-panel" style={{ background: "#ffffff" }}>
      <div className="editorial-panel-header" style={{ padding: "16px 22px" }}>
        <div>
          <div className="editorial-kicker" style={{ color: "var(--accent)" }}>
            ÇALIŞMA ALANI · SORU {index + 1} / {questions.length}
          </div>
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {QUESTION_TYPE_LABELS[q.type]} · {q.points} Puan Değerinde
          </span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge" style={{ background: "var(--surface-subtle)", fontSize: "0.8rem" }}>
            Deneme #{attemptNumber}
          </span>
          <span
            className="badge"
            style={{
              background: saveState === "error" ? "var(--crimson-light)" : "var(--leaf-light)",
              color: saveState === "error" ? "var(--crimson)" : "var(--leaf)",
              fontSize: "0.8rem",
            }}
          >
            {saveState === "saving" ? "Kaydediliyor…" : saveState === "saved" ? "✓ Kaydedildi" : saveState === "error" ? "Kaydetme Hatası" : "Otomatik Kayıt"}
          </span>
        </div>
      </div>

      <div style={{ height: 3, background: "var(--border)", width: "100%" }}>
        <div style={{ height: "100%", width: `${progressPercent}%`, background: "var(--accent)", transition: "width 0.25s ease" }} />
      </div>

      <div style={{ padding: "20px 22px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
        <nav className="q-dots" aria-label="Sorular" style={{ margin: 0, gap: 6 }}>
          {questions.map((x, i) => {
            const done = hasAnswer(x.type, answers[x.id]);
            return (
              <button
                key={x.id}
                type="button"
                className={`${i === index ? "current" : ""} ${done ? "answered" : ""}`}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Soru ${i + 1}${done ? ", cevaplandı" : ", henüz cevaplanmadı"}`}
                onClick={() => setIndex(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-xs)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {done ? "✓" : i + 1}
              </button>
            );
          })}
        </nav>
      </div>

      <div style={{ padding: "28px 24px" }}>
        <section aria-labelledby={`qt-${q.id}`} style={{ marginBottom: 28 }}>
          <h2
            id={`qt-${q.id}`}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.22rem",
              lineHeight: 1.6,
              color: "var(--ink)",
              margin: "0 0 20px",
              whiteSpace: "pre-wrap",
            }}
          >
            {q.questionText}
          </h2>

          <div style={{ padding: "4px 0 16px" }}>
            <QuestionRenderer question={q} value={answers[q.id] ?? null} onChange={(v) => change(q.id, v)} disabled={submitting} />
          </div>

          {!hasAnswer(q.type, answers[q.id]) && (
            <p className="muted" style={{ fontSize: "0.85rem", margin: "10px 0 0", fontStyle: "italic" }}>
              Bu soruyu henüz cevaplamadın.
            </p>
          )}
        </section>

        {error && <p className="notice-inline error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

        <div className="row" style={{ justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button type="button" onClick={() => setIndex((i) => i - 1)} disabled={index === 0} style={{ padding: "8px 16px" }}>
            ← Önceki Soru
          </button>

          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={() => void flush()} disabled={submitting} style={{ padding: "8px 14px", fontSize: "0.88rem" }}>
              Cevapları Kaydet
            </button>
            {index < questions.length - 1 ? (
              <button type="button" className="primary" onClick={() => setIndex((i) => i + 1)} style={{ padding: "8px 18px" }}>
                Sonraki Soru →
              </button>
            ) : (
              <button type="button" className="primary" onClick={submit} disabled={submitting} style={{ padding: "8px 22px" }}>
                {submitting ? "Gönderiliyor…" : "Çalışmayı Tamamla ve Gönder"}
              </button>
            )}
          </div>
        </div>

        {unanswered.length > 0 && index === questions.length - 1 && (
          <p className="notice-inline warn" style={{ marginTop: 14 }}>
            Dikkat: {unanswered.length} soru henüz cevaplanmadı. Dilerseniz önceki sorulara dönüp kontrol edebilirsiniz.
          </p>
        )}
      </div>
    </div>
  );
}

export function StartAttempt({ assignmentId, label }: { assignmentId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/student/assignments/${assignmentId}/attempts`, { method: "POST" });
          setBusy(false);
          if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Başlatılamadı.");
          else router.refresh();
        }}
      >
        {busy ? "Başlatılıyor…" : label}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
