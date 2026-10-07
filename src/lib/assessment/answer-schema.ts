// Student answer formats per question type. Drafts (autosave) may be incomplete; nothing here
// ever carries a score – scoring happens only in scoring-service on the server.

import { z } from "zod";

const text = (max: number) => z.string().max(max, `Cevap en fazla ${max} karakter olabilir.`);

export const answerSchemas = {
  MULTIPLE_CHOICE: z.object({ selectedIndex: z.number().int().min(0).max(5) }),
  TRUE_FALSE: z.object({ value: z.boolean() }),
  FILL_IN_THE_BLANK: z.object({ text: text(200) }),
  // matches[i] = the right-hand text chosen for left item i (null = not chosen yet)
  MATCHING: z.object({ matches: z.array(z.string().max(300).nullable()).max(8) }),
  // order = indices into the displayed items, in the order the student arranged them
  ORDERING: z.object({ order: z.array(z.number().int().min(0).max(7)).max(8) }),
  SHORT_ANSWER: z.object({ text: text(1000) }),
  LONG_ANSWER: z.object({ text: text(5000) }),
  CONTEXT_BASED: z.union([z.object({ selectedIndex: z.number().int().min(0).max(5) }), z.object({ text: text(1000) })]),
  IMAGE_INTERPRETATION: z.object({ text: text(1000) }),
} as const;

export type AnswerValue = Record<string, unknown>;

/** Validate an answer for a stored question; also checks indices/texts against the question data. */
export function validateAnswer(question: { type: string; data: unknown }, answer: unknown): { ok: true; value: AnswerValue } | { ok: false; message: string } {
  const schema = answerSchemas[question.type as keyof typeof answerSchemas];
  if (!schema) return { ok: false, message: "Bilinmeyen soru türü." };
  const parsed = schema.safeParse(answer);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz cevap." };
  const v = parsed.data as AnswerValue;
  const d = question.data as Record<string, unknown>;
  if ("selectedIndex" in v) {
    const options = (d.options as string[] | null) ?? [];
    if (!options.length || (v.selectedIndex as number) >= options.length) return { ok: false, message: "Geçersiz seçenek." };
  }
  if (question.type === "MATCHING") {
    const pairs = d.pairs as { right: string }[];
    const m = v.matches as (string | null)[];
    if (m.length !== pairs.length || m.some((x) => x !== null && !pairs.some((p) => p.right === x))) return { ok: false, message: "Geçersiz eşleştirme." };
  }
  if (question.type === "ORDERING") {
    const items = d.items as string[];
    const order = v.order as number[];
    if (order.length !== items.length || new Set(order).size !== order.length || order.some((i) => i >= items.length)) return { ok: false, message: "Geçersiz sıralama." };
  }
  if (question.type === "CONTEXT_BASED" && Boolean(d.options) !== "selectedIndex" in v) return { ok: false, message: "Bu soru için cevap biçimi uygun değil." };
  return { ok: true, value: v };
}

/** True when the answer actually contains a response (used for "unanswered" counts). */
export function isAnswered(type: string, a: AnswerValue | null | undefined): boolean {
  if (!a) return false;
  if ("text" in a) return String(a.text).trim().length > 0;
  if (type === "MATCHING") return (a.matches as (string | null)[]).some((x) => x !== null);
  return true;
}
