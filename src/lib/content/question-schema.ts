// Strict question model shared by AI output validation, the teacher editor and the DB layer.
// Common fields live in Question columns; type-specific fields are stored in Question.data.

import { z } from "zod";

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_IN_THE_BLANK",
  "MATCHING",
  "ORDERING",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "CONTEXT_BASED",
  "IMAGE_INTERPRETATION",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Çoktan seçmeli",
  TRUE_FALSE: "Doğru / Yanlış",
  FILL_IN_THE_BLANK: "Boşluk doldurma",
  MATCHING: "Eşleştirme",
  ORDERING: "Sıralama",
  SHORT_ANSWER: "Kısa cevap",
  LONG_ANSWER: "Uzun cevap",
  CONTEXT_BASED: "Bağlam temelli",
  IMAGE_INTERPRETATION: "Görsel yorumlama",
};

const text = (max: number, label: string) => z.string().trim().min(1, `${label} boş olamaz.`).max(max, `${label} en fazla ${max} karakter olabilir.`);
const item = text(300, "Seçenek");

const common = {
  questionText: text(1500, "Soru metni"),
  explanation: z.string().trim().max(1000).nullish().transform((v) => v || null),
  points: z.coerce.number().int("Puan tam sayı olmalıdır.").min(1, "Puan en az 1 olmalıdır.").max(100, "Puan en fazla 100 olabilir."),
  curriculumOutcomeCodes: z.array(z.string().trim().min(1)).max(10).default([]),
};

const multipleChoice = z
  .object({ type: z.literal("MULTIPLE_CHOICE"), ...common, options: z.array(item).min(2).max(6), correctAnswer: item })
  .refine((q) => q.options.includes(q.correctAnswer), { path: ["correctAnswer"], message: "Doğru cevap seçeneklerden biri olmalıdır." })
  .refine((q) => new Set(q.options).size === q.options.length, { path: ["options"], message: "Seçenekler birbirinden farklı olmalıdır." });

const trueFalse = z.object({ type: z.literal("TRUE_FALSE"), ...common, correctAnswer: z.boolean() });

const fillInTheBlank = z.object({
  type: z.literal("FILL_IN_THE_BLANK"),
  ...common,
  correctAnswer: text(200, "Doğru cevap"),
  acceptableAnswers: z.array(text(200, "Kabul edilen cevap")).max(10).default([]),
});

const matching = z.object({
  type: z.literal("MATCHING"),
  ...common,
  pairs: z.array(z.object({ left: item, right: item })).min(2).max(8),
});

const ordering = z
  .object({ type: z.literal("ORDERING"), ...common, items: z.array(item).min(2).max(8), correctOrder: z.array(z.number().int().min(0)) })
  .refine((q) => q.correctOrder.length === q.items.length && [...q.correctOrder].sort((a, b) => a - b).every((v, i) => v === i), {
    path: ["correctOrder"],
    message: "Doğru sıra, öğelerin her birini bir kez içermelidir.",
  });

const shortAnswer = z.object({ type: z.literal("SHORT_ANSWER"), ...common, sampleAnswer: text(500, "Örnek cevap") });

const longAnswer = z.object({
  type: z.literal("LONG_ANSWER"),
  ...common,
  sampleAnswer: text(1500, "Örnek cevap"),
  rubric: z.string().trim().max(1000).nullish().transform((v) => v || null),
});

const contextBased = z
  .object({
    type: z.literal("CONTEXT_BASED"),
    ...common,
    context: text(1500, "Bağlam metni"),
    // With options it is answered like multiple choice; without, as a short answer.
    options: z.array(item).min(2).max(6).nullish().transform((v) => v ?? null),
    correctAnswer: text(500, "Doğru cevap"),
  })
  .refine((q) => !q.options || q.options.includes(q.correctAnswer), { path: ["correctAnswer"], message: "Doğru cevap seçeneklerden biri olmalıdır." });

const imageInterpretation = z.object({
  type: z.literal("IMAGE_INTERPRETATION"),
  ...common,
  // The AI cannot attach images: it describes the visual the teacher should provide.
  imageDescription: text(800, "Görsel açıklaması"),
  imageUrl: z
    .string()
    .trim()
    .url("Görsel adresi geçerli bir URL olmalıdır.")
    .refine((u) => u.startsWith("https://"), "Görsel adresi https ile başlamalıdır.")
    .nullish()
    .transform((v) => v || null),
  sampleAnswer: text(500, "Örnek cevap"),
});

export const questionSchema = z.discriminatedUnion("type", [
  multipleChoice,
  trueFalse,
  fillInTheBlank,
  matching,
  ordering,
  shortAnswer,
  longAnswer,
  contextBased,
  imageInterpretation,
]);
export type QuestionInput = z.input<typeof questionSchema>;
export type ValidQuestion = z.output<typeof questionSchema>;

/** Split a validated question into DB columns + type-specific JSON data. */
export function toQuestionRow(q: ValidQuestion) {
  const { type, questionText, explanation, points, curriculumOutcomeCodes, ...data } = q;
  return { type, questionText, explanation, points, curriculumOutcomeCodes, data };
}

/** Rebuild the strict question shape from a stored row (used by the editor). */
export function fromQuestionRow(row: { type: string; questionText: string; explanation: string | null; points: number; data: unknown }, codes: string[]) {
  return { ...(row.data as Record<string, unknown>), type: row.type, questionText: row.questionText, explanation: row.explanation, points: row.points, curriculumOutcomeCodes: codes };
}

/** Student-facing view: never includes correct answers, sample answers or explanations. */
export function toStudentQuestion(row: { id: string; type: string; questionText: string; points: number; data: unknown }) {
  const d = row.data as Record<string, unknown>;
  const base = { id: row.id, type: row.type as QuestionType, questionText: row.questionText, points: row.points };
  switch (row.type) {
    case "MULTIPLE_CHOICE":
      return { ...base, options: d.options as string[] };
    case "MATCHING": {
      const pairs = d.pairs as { left: string; right: string }[];
      return { ...base, left: pairs.map((p) => p.left), right: [...pairs.map((p) => p.right)].sort((a, b) => a.localeCompare(b, "tr")) };
    }
    case "ORDERING":
      return { ...base, items: d.items as string[] };
    case "CONTEXT_BASED":
      return { ...base, context: d.context as string, options: (d.options as string[] | null) ?? null };
    case "IMAGE_INTERPRETATION":
      return { ...base, imageDescription: d.imageDescription as string, imageUrl: (d.imageUrl as string | null) ?? null };
    default:
      return base;
  }
}
export type StudentQuestion = ReturnType<typeof toStudentQuestion>;
