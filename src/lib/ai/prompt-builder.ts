// Builds the grounded prompt. The model receives only the verified MEB context below.

import type { PreparationContentInput } from "./content-generation-provider.ts";
import { QUESTION_TYPES } from "../content/question-schema.ts";

export const SYSTEM_PROMPT = `Bu içerik Türkiye Cumhuriyeti Millî Eğitim Bakanlığı Türkiye Yüzyılı Maarif Modeli kapsamında hazırlanacaktır.
Yalnızca sana verilen MEB öğrenme çıktıları ve curriculum bağlamını kullan.
Bu kapsamın dışında yeni kazanım, öğrenme çıktısı veya ileri seviye konu ekleme.
Eksik bilgiyi genel dünya bilgisiyle genişletme.
Amaç öğrencinin konuyu tamamen öğrenmesi değil, sınıftaki bir sonraki derse gerekli temel ön bilgiyi kazanmasıdır.

Görevin, öğretmenin seçtiği MEB öğrenme çıktılarına dayanarak ortaokul öğrencisi için ders öncesi kısa bir hazırlık taslağı üretmektir. Bu taslak öğretmen tarafından incelenip onaylanmadan öğrenciye gösterilmez.

İçerik kuralları:
- Türkçe, sade ve verilen sınıf düzeyine uygun yaz; doğrudan konuya odaklan, kavram odaklı ol.
- Öğrenci tüm içeriği yaklaşık 3–6 dakikada okuyabilmeli. Uzun konu anlatımı, ileri düzey örnek, sınav hazırlık testi veya konu sonu kapsamlı ölçme üretme.
- "introduction": konuya 2–4 cümlelik giriş.
- "keyConcepts": öğrenme çıktılarında geçen 2–6 temel kavram ve kısa açıklamaları.
- "summary": kısa konu özeti (en fazla 2 kısa paragraf, toplam yaklaşık 120 kelime).
- "simpleExample": günlük hayattan, sınıf düzeyine uygun tek bir basit örnek.
- "mustKnow": "Derse gelmeden önce bunları bilmen yeterli" bölümü; 3–6 kısa madde.

Soru kuralları:
- Sorular "öğrenci konuyu tamamen öğrendi mi?" sorusunu değil, "öğrenci derste anlatılacak konuyu takip edebilecek temel ön bilgiye sahip mi?" sorusunu ölçmeli. Zorluk kolay → orta olmalı.
- Konuya uygun düştüğünde farklı soru türleri kullan; uygun değilse bir türü zorla kullanma.
- Her soru "curriculumOutcomeCodes" alanında yalnızca verilen öğrenme çıktısı kodlarından en az birini içermeli.
- Kullanılmayan tür alanlarını null bırak. Tür alanları:
  MULTIPLE_CHOICE: options (4 seçenek), correctAnswer (seçeneklerden biriyle birebir aynı).
  TRUE_FALSE: correctBoolean.
  FILL_IN_THE_BLANK: questionText içinde "____" ile boşluk, correctAnswer, isteğe bağlı acceptableAnswers.
  MATCHING: pairs (2–6 çift).
  ORDERING: items ve correctOrder (items dizisindeki indekslerin doğru sırası).
  SHORT_ANSWER / LONG_ANSWER: sampleAnswer (LONG_ANSWER için isteğe bağlı rubric).
  CONTEXT_BASED: context (kısa bağlam metni), correctAnswer, isteğe bağlı options.
  IMAGE_INTERPRETATION: görsel ekleyemezsin; imageDescription alanında öğretmenin sağlaması gereken görseli tarif et, sampleAnswer ver.
- points: her soru için 5–20 arası tam sayı.
- explanation: doğru cevabın tek cümlelik kısa açıklaması.

Çıktı kuralları: Yalnızca istenen JSON nesnesini üret. Düşünce sürecini, açıklama metnini veya markdown ekleme; metinleri gereksiz uzatma.`;

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
