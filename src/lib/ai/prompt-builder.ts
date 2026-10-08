// Builds the grounded prompt. The model receives only the verified MEB context below.

import type { PreparationContentInput } from "./content-generation-provider.ts";
import { QUESTION_TYPES } from "../content/question-schema.ts";

export const SYSTEM_PROMPT = `Türkiye Yüzyılı Maarif Modeli kapsamında ortaokul ders öncesi hazırlık taslağı üreten pedagojik bir asistansın.
Yalnızca sana verilen MEB öğrenme çıktıları ve curriculum bağlamını kullan. Dışarıdan konu veya kazanım ekleme. Türkçe ve yalın yaz.
Öğrenci içeriği 3–5 dakikada okuyabilmeli. Sorular kolay-orta düzeyde temel ön bilgi kontrolü olmalıdır.

İçerik kuralları:
- introduction: Konuya 2–3 cümlelik giriş.
- keyConcepts: 2–4 temel kavram ve kısa açıklaması (term, explanation).
- summary: En fazla 2 kısa paragraf, yaklaşık 100–120 kelimelik kısa ders özeti.
- simpleExample: Günlük hayattan tek bir somut örnek.
- mustKnow: 3–5 kısa madde ("Derse gelmeden önce bunları bilmen yeterli").

Soru kuralları:
- Her soru "curriculumOutcomeCodes" alanında verilen MEB kodlarından en az birini içermelidir.
- points: 5–20 arası tam sayı.
- explanation: Doğru cevabın 1 cümlelik kısa açıklaması.
- Sorularda soru metnini, işlem adımlarını ve seçenekleri çok kısa, yalın ve net tut; uzatma.
- Soru türleri:
  * MULTIPLE_CHOICE: options (4 kısa seçenek), correctAnswer (seçeneklerden birinin tam metni).
  * TRUE_FALSE: correctBoolean.
  * FILL_IN_THE_BLANK: questionText içinde "____" boşluk, correctAnswer.
  * MATCHING: pairs dizisi (left, right).
  * ORDERING: items ve correctOrder (indeks sırası).
  * SHORT_ANSWER: sampleAnswer.
Kullanılmayan tür alanlarını null bırak.

Çıktı kuralları: Yalnızca istenen tek JSON nesnesini üret. Düşünce metni, açıklama veya markdown ekleme; metinleri kısa ve öz tut.`;

const SCOPE_TASK = {
  ALL: "Hazırlık içeriğinin tamamını (introduction, keyConcepts, summary, simpleExample, mustKnow) ve soruları üret.",
  SUMMARY: "Yalnızca hazırlık içeriğini (introduction, keyConcepts, summary, simpleExample, mustKnow) üret; soru üretme.",
  QUESTIONS: "Yalnızca ön bilgi kontrol sorularını üret.",
} as const;

export function buildUserPrompt(input: PreparationContentInput): string {
  const context = {
    subject: input.subject,
    grade: input.grade,
    unitOrTheme: input.unitOrTheme,
    teacherTopic: input.teacherTopic,
    mebOutcomes: input.outcomes.map((o) => ({ code: o.code, text: o.text, processComponents: o.processComponents })),
    ...(input.scope === "SUMMARY" ? {} : { questionCount: input.questionCount, allowedQuestionTypes: QUESTION_TYPES }),
  };
  return [
    SCOPE_TASK[input.scope],
    input.scope === "SUMMARY" ? "" : `Tam olarak ${input.questionCount} soru üret.`,
    "Doğrulanmış MEB curriculum bağlamı (yalnızca bunu kullan):",
    "<curriculum_context>",
    JSON.stringify(context),
    "</curriculum_context>",
  ]
    .filter(Boolean)
    .join("\n");
}
