// Validation for the preparation content ("Hazırlık İçeriği") – used for AI output and for the
// teacher's manual edits alike.

import { z } from "zod";

const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} en fazla ${max} karakter olabilir.`);

export const studyContentSchema = z.object({
  introduction: optionalText(1500, "Konuya giriş"),
  keyConcepts: z
    .array(
      z.object({
        term: z.string().trim().min(1, "Kavram adı boş olamaz.").max(100, "Kavram adı en fazla 100 karakter olabilir."),
        explanation: z.string().trim().min(1, "Kavram açıklaması boş olamaz.").max(500, "Kavram açıklaması en fazla 500 karakter olabilir."),
      }),
    )
    .max(10, "En fazla 10 kavram eklenebilir."),
  // ~3–6 minutes of reading for a middle-school student.
  summary: optionalText(5000, "Konu özeti"),
  simpleExample: optionalText(2000, "Basit örnek"),
  mustKnow: z.array(z.string().trim().min(1, "Madde boş olamaz.").max(300, "Madde en fazla 300 karakter olabilir.")).max(6, "En fazla 6 madde eklenebilir."),
});

export type StudyContentInput = z.input<typeof studyContentSchema>;
export type ValidStudyContent = z.output<typeof studyContentSchema>;

export const QUESTION_COUNT_MIN = 5;
export const QUESTION_COUNT_MAX = 10;
export const DEFAULT_QUESTION_COUNT = 7;
export const questionCountSchema = z.coerce
  .number()
  .int("Soru sayısı tam sayı olmalıdır.")
  .min(QUESTION_COUNT_MIN, `Soru sayısı en az ${QUESTION_COUNT_MIN} olmalıdır.`)
  .max(QUESTION_COUNT_MAX, `Soru sayısı en fazla ${QUESTION_COUNT_MAX} olabilir.`);
