"use client";

// Add/edit form for one pre-knowledge question. Fields change with the question type; the payload
// is checked with the same Zod schema the server uses before it is sent.

import { useState } from "react";
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, questionSchema, type QuestionType } from "@/lib/content/question-schema.ts";

export interface OutcomeOption {
  code: string;
  text: string;
}

interface FormState {
  type: QuestionType;
  questionText: string;
  explanation: string;
  points: string;
  codes: string[];
  options: string[];
  correctIndex: number;
  correctBoolean: boolean;
  correctAnswer: string;
  acceptableAnswers: string;
  pairs: { left: string; right: string }[];
  orderedItems: string[]; // entered in the CORRECT order
  sampleAnswer: string;
  rubric: string;
  context: string;
  contextHasOptions: boolean;
  imageDescription: string;
  imageUrl: string;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function emptyState(type: QuestionType = "MULTIPLE_CHOICE"): FormState {
  return {
    type,
    questionText: "",
    explanation: "",
    points: "10",
    codes: [],
    options: ["", "", "", ""],
    correctIndex: 0,
    correctBoolean: true,
    correctAnswer: "",
    acceptableAnswers: "",
    pairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
    orderedItems: ["", "", ""],
    sampleAnswer: "",
    rubric: "",
    context: "",
    contextHasOptions: false,
    imageDescription: "",
    imageUrl: "",
  };
}

/** Rebuild form state from a stored question (strict shape: common fields + data). */
export function stateFromQuestion(q: Record<string, unknown> & { type: string }): FormState {
  const s = emptyState(q.type as QuestionType);
  s.questionText = String(q.questionText ?? "");
  s.explanation = String(q.explanation ?? "");
  s.points = String(q.points ?? 10);
  s.codes = (q.curriculumOutcomeCodes as string[]) ?? [];
  const options = q.options as string[] | null | undefined;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
      s.options = options ?? s.options;
      s.correctIndex = Math.max(0, s.options.indexOf(String(q.correctAnswer)));
      break;
    case "TRUE_FALSE":
      s.correctBoolean = q.correctAnswer === true;
      break;
    case "FILL_IN_THE_BLANK":
      s.correctAnswer = String(q.correctAnswer ?? "");
      s.acceptableAnswers = ((q.acceptableAnswers as string[]) ?? []).join(", ");
      break;
    case "MATCHING":
      s.pairs = (q.pairs as FormState["pairs"]) ?? s.pairs;
      break;
    case "ORDERING": {
      const items = (q.items as string[]) ?? [];
      const order = (q.correctOrder as number[]) ?? [];
      s.orderedItems = order.length === items.length ? order.map((i) => items[i]) : items;
      break;
    }
    case "SHORT_ANSWER":
    case "LONG_ANSWER":
      s.sampleAnswer = String(q.sampleAnswer ?? "");
      s.rubric = String(q.rubric ?? "");
      break;
    case "CONTEXT_BASED":
      s.context = String(q.context ?? "");
      s.correctAnswer = String(q.correctAnswer ?? "");
      s.contextHasOptions = Boolean(options);
      if (options) {
        s.options = options;
        s.correctIndex = Math.max(0, options.indexOf(String(q.correctAnswer)));
      }
      break;
    case "IMAGE_INTERPRETATION":
      s.imageDescription = String(q.imageDescription ?? "");
      s.imageUrl = String(q.imageUrl ?? "");
      s.sampleAnswer = String(q.sampleAnswer ?? "");
      break;
  }
  return s;
}

function toPayload(s: FormState): Record<string, unknown> {
  const common = { type: s.type, questionText: s.questionText, explanation: s.explanation || null, points: s.points, curriculumOutcomeCodes: s.codes };
  const options = s.options.map((o) => o.trim()).filter(Boolean);
  switch (s.type) {
    case "MULTIPLE_CHOICE":
      return { ...common, options, correctAnswer: s.options[s.correctIndex]?.trim() ?? "" };
    case "TRUE_FALSE":
      return { ...common, correctAnswer: s.correctBoolean };
    case "FILL_IN_THE_BLANK":
      return { ...common, correctAnswer: s.correctAnswer, acceptableAnswers: s.acceptableAnswers.split(",").map((x) => x.trim()).filter(Boolean) };
    case "MATCHING":
      return { ...common, pairs: s.pairs.filter((p) => p.left.trim() || p.right.trim()) };
    case "ORDERING": {
      // Students must not see the answer order: show the items rotated by one.
      const correct = s.orderedItems.map((x) => x.trim()).filter(Boolean);
      const shown = correct.length > 1 ? [...correct.slice(1), correct[0]] : correct;
      return { ...common, items: shown, correctOrder: correct.map((c) => shown.indexOf(c)) };
    }
    case "SHORT_ANSWER":
      return { ...common, sampleAnswer: s.sampleAnswer };
    case "LONG_ANSWER":
      return { ...common, sampleAnswer: s.sampleAnswer, rubric: s.rubric || null };
    case "CONTEXT_BASED":
      return s.contextHasOptions
        ? { ...common, context: s.context, options, correctAnswer: s.options[s.correctIndex]?.trim() ?? "" }
        : { ...common, context: s.context, options: null, correctAnswer: s.correctAnswer };
    case "IMAGE_INTERPRETATION":
      return { ...common, imageDescription: s.imageDescription, imageUrl: s.imageUrl || null, sampleAnswer: s.sampleAnswer };
  }
}

export function QuestionForm({
  initial,
  outcomes,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: FormState;
  outcomes: OutcomeOption[];
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<Record<string, string[]> | null>;
  onCancel: () => void;
}) {
  const [s, setS] = useState<FormState>(initial ?? emptyState());
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setS((p) => ({ ...p, [k]: v }));
  const setAt = <K extends "options" | "orderedItems">(k: K, i: number, v: string) => setS((p) => ({ ...p, [k]: p[k].map((x, j) => (j === i ? v : x)) }));

  async function submit() {
    const payload = toPayload(s);
    const check = questionSchema.safeParse(payload);
    if (!check.success) {
      const errs: Record<string, string[]> = {};
      for (const i of check.error.issues) (errs[i.path.join(".") || "_form"] ??= []).push(i.message);
      setErrors(errs);
      return;
    }
    setBusy(true);
    const serverErrors = await onSubmit(payload);
    setBusy(false);
    if (serverErrors) setErrors(serverErrors);
  }

  const allErrors = Object.entries(errors).flatMap(([k, v]) => v.map((m) => `${k === "_form" ? "" : `${k}: `}${m}`));
  const optionEditor = (
    <>
      <label>Seçenekler (doğru olanı işaretleyin)</label>
      {s.options.map((o, i) => (
        <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
          <input type="radio" name="correct" aria-label={`Doğru seçenek ${LETTERS[i]}`} checked={s.correctIndex === i} onChange={() => set("correctIndex", i)} />
          <input type="text" aria-label={`Seçenek ${LETTERS[i]}`} placeholder={`Seçenek ${LETTERS[i]}`} value={o} onChange={(e) => setAt("options", i, e.target.value)} />
        </div>
      ))}
      <div className="row">
        {s.options.length < 6 && <button type="button" onClick={() => set("options", [...s.options, ""])}>+ Seçenek</button>}
        {s.options.length > 2 && <button type="button" onClick={() => setS((p) => ({ ...p, options: p.options.slice(0, -1), correctIndex: Math.min(p.correctIndex, p.options.length - 2) }))}>− Seçenek</button>}
      </div>
    </>
  );

  return (
    <div className="editorial-panel question-form" style={{ padding: 24, margin: "16px 0" }}>
      <div className="editorial-kicker" style={{ color: "var(--accent)" }}>SORU YAPILANDIRMASI</div>
      <label htmlFor="q-type" style={{ marginTop: 4 }}>Soru türü</label>
      <select id="q-type" value={s.type} onChange={(e) => set("type", e.target.value as QuestionType)}>
        {QUESTION_TYPES.map((t) => (
          <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
        ))}
      </select>

      {s.type === "CONTEXT_BASED" && (
        <>
          <label htmlFor="q-context">Bağlam metni</label>
          <textarea id="q-context" rows={4} value={s.context} onChange={(e) => set("context", e.target.value)} />
        </>
      )}
      {s.type === "IMAGE_INTERPRETATION" && (
        <>
          <label htmlFor="q-imgdesc">Görsel açıklaması</label>
          <textarea id="q-imgdesc" rows={3} value={s.imageDescription} onChange={(e) => set("imageDescription", e.target.value)} />
          <label htmlFor="q-imgurl">Görsel adresi (https, isteğe bağlı)</label>
          <input id="q-imgurl" type="text" value={s.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
        </>
      )}

      <label htmlFor="q-text">Soru {s.type === "FILL_IN_THE_BLANK" && <span className="muted">(boşluk için ____ kullanın)</span>}</label>
      <textarea id="q-text" rows={3} value={s.questionText} onChange={(e) => set("questionText", e.target.value)} />

      {s.type === "MULTIPLE_CHOICE" && optionEditor}
      {s.type === "CONTEXT_BASED" && (
        <>
          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={s.contextHasOptions} onChange={(e) => set("contextHasOptions", e.target.checked)} /> Seçenekli soru
          </label>
          {s.contextHasOptions ? optionEditor : (
            <>
              <label htmlFor="q-ctx-answer">Doğru cevap</label>
              <input id="q-ctx-answer" type="text" value={s.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} />
            </>
          )}
        </>
      )}
      {s.type === "TRUE_FALSE" && (
        <>
          <label>Doğru cevap</label>
          <div className="row">
            <label className="row" style={{ fontWeight: 400 }}><input type="radio" checked={s.correctBoolean} onChange={() => set("correctBoolean", true)} /> Doğru</label>
            <label className="row" style={{ fontWeight: 400 }}><input type="radio" checked={!s.correctBoolean} onChange={() => set("correctBoolean", false)} /> Yanlış</label>
          </div>
        </>
      )}
      {s.type === "FILL_IN_THE_BLANK" && (
        <>
          <label htmlFor="q-fill">Doğru cevap</label>
          <input id="q-fill" type="text" value={s.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} />
          <label htmlFor="q-alt">Kabul edilen diğer cevaplar (virgülle)</label>
          <input id="q-alt" type="text" value={s.acceptableAnswers} onChange={(e) => set("acceptableAnswers", e.target.value)} />
        </>
      )}
      {s.type === "MATCHING" && (
        <>
          <label>Eşleşen çiftler</label>
          {s.pairs.map((p, i) => (
            <div key={i} className="row" style={{ flexWrap: "nowrap" }}>
              <input type="text" aria-label={`Sol ${i + 1}`} placeholder="Sol" value={p.left} onChange={(e) => set("pairs", s.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
              <input type="text" aria-label={`Sağ ${i + 1}`} placeholder="Sağ" value={p.right} onChange={(e) => set("pairs", s.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
            </div>
          ))}
          <div className="row">
            {s.pairs.length < 8 && <button type="button" onClick={() => set("pairs", [...s.pairs, { left: "", right: "" }])}>+ Çift</button>}
            {s.pairs.length > 2 && <button type="button" onClick={() => set("pairs", s.pairs.slice(0, -1))}>− Çift</button>}
          </div>
        </>
      )}
      {s.type === "ORDERING" && (
        <>
          <label>Öğeler (doğru sırayla yazın; öğrenciye karışık gösterilir)</label>
          {s.orderedItems.map((it, i) => (
            <input key={i} type="text" aria-label={`Öğe ${i + 1}`} placeholder={`${i + 1}. öğe`} value={it} onChange={(e) => setAt("orderedItems", i, e.target.value)} />
          ))}
          <div className="row">
            {s.orderedItems.length < 8 && <button type="button" onClick={() => set("orderedItems", [...s.orderedItems, ""])}>+ Öğe</button>}
            {s.orderedItems.length > 2 && <button type="button" onClick={() => set("orderedItems", s.orderedItems.slice(0, -1))}>− Öğe</button>}
          </div>
        </>
      )}
      {(s.type === "SHORT_ANSWER" || s.type === "LONG_ANSWER" || s.type === "IMAGE_INTERPRETATION") && (
        <>
          <label htmlFor="q-sample">Örnek cevap</label>
          <textarea id="q-sample" rows={s.type === "LONG_ANSWER" ? 4 : 2} value={s.sampleAnswer} onChange={(e) => set("sampleAnswer", e.target.value)} />
        </>
      )}
      {s.type === "LONG_ANSWER" && (
        <>
          <label htmlFor="q-rubric">Değerlendirme ölçütü (isteğe bağlı)</label>
          <textarea id="q-rubric" rows={2} value={s.rubric} onChange={(e) => set("rubric", e.target.value)} />
        </>
      )}

      <label htmlFor="q-expl">Açıklama (isteğe bağlı)</label>
      <textarea id="q-expl" rows={2} value={s.explanation} onChange={(e) => set("explanation", e.target.value)} />
      <label htmlFor="q-points">Puan</label>
      <input id="q-points" type="number" min={1} max={100} value={s.points} onChange={(e) => set("points", e.target.value)} />

      <label>Bağlı MEB öğrenme çıktısı</label>
      {outcomes.map((o) => (
        <label key={o.code} className="row" style={{ fontWeight: 400, flexWrap: "nowrap", alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={s.codes.includes(o.code)}
            onChange={(e) => set("codes", e.target.checked ? [...s.codes, o.code] : s.codes.filter((c) => c !== o.code))}
          />
          <span><span className="code" style={{ display: "inline" }}>{o.code}</span> {o.text}</span>
        </label>
      ))}

      {allErrors.map((m) => <p key={m} className="error" role="alert">{m}</p>)}
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="primary" onClick={submit} disabled={busy}>{busy ? "Kaydediliyor…" : submitLabel}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Vazgeç</button>
      </div>
    </div>
  );
}
