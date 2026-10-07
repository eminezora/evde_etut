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

  return (
    <div className="runner">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong aria-live="polite">{index + 1} / {questions.length} soru</strong>
        <span className="muted" aria-live="polite">
          {saveState === "saving" ? "Kaydediliyor…" : saveState === "saved" ? "✓ Kaydedildi" : saveState === "error" ? "Kaydedilemedi" : ""} · Deneme {attemptNumber}
        </span>
      </div>
      <nav className="q-dots" aria-label="Sorular">
        {questions.map((x, i) => {
          const done = hasAnswer(x.type, answers[x.id]);
          return (
            <button
              key={x.id}
              type="button"
              className={`${i === index ? "current" : ""} ${done ? "answered" : ""}`}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Soru ${i + 1}${done ? ", cevaplandı" : ", cevaplanmadı"}`}
              onClick={() => setIndex(i)}
            >
              {done ? "✓" : i + 1}
            </button>
          );
        })}
      </nav>

      <section className="card question-card-student" aria-labelledby={`qt-${q.id}`}>
        <p className="muted" style={{ margin: 0 }}>{QUESTION_TYPE_LABELS[q.type]} · {q.points} puan</p>
        <h2 id={`qt-${q.id}`} style={{ whiteSpace: "pre-wrap" }}>{q.questionText}</h2>
        <QuestionRenderer question={q} value={answers[q.id] ?? null} onChange={(v) => change(q.id, v)} disabled={submitting} />
        {!hasAnswer(q.type, answers[q.id]) && <p className="muted">Bu soruyu henüz cevaplamadın.</p>}
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>← Önceki</button>
        {index < questions.length - 1 ? (
          <button type="button" className="primary" onClick={() => setIndex((i) => i + 1)}>Sonraki →</button>
        ) : (
          <button type="button" className="primary" onClick={submit} disabled={submitting}>{submitting ? "Gönderiliyor…" : "Çalışmayı Bitir"}</button>
        )}
      </div>
      {unanswered.length > 0 && index === questions.length - 1 && <p className="muted">{unanswered.length} soruyu henüz cevaplamadın.</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" onClick={() => void flush()} disabled={submitting}>Cevapları Kaydet</button>
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
