// Deterministic development/test provider (AI_PROVIDER=mock). It calls no model and adds no
// curriculum knowledge: every sentence is a clearly marked placeholder built from the teacher's
// topic and the selected MEB outcome texts, so the editor/publish flow can be exercised offline.
// Disabled in production by the provider factory.

import type { ContentGenerationProvider, PreparationContentInput, ProviderResult } from "../content-generation-provider.ts";

const TAG = "[Deneme taslağı]";

export class MockContentProvider implements ContentGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-preparation-v1";

  async generatePreparationContent(input: PreparationContentInput): Promise<ProviderResult> {
    const codes = input.outcomes.map((o) => o.code);
    const content = {
      introduction: `${TAG} "${input.teacherTopic}" konusu için ders öncesi hazırlık. Bu metni öğretmen düzenlemelidir.`,
      keyConcepts: input.outcomes.slice(0, 6).map((o) => ({ term: o.code, explanation: `${TAG} ${o.text}` })),
      summary: `${TAG} Bu bölüm seçilen MEB öğrenme çıktılarına göre öğretmen tarafından yazılmalıdır:\n${input.outcomes.map((o) => `- ${o.code}: ${o.text}`).join("\n")}`,
      simpleExample: `${TAG} Öğretmen buraya "${input.teacherTopic}" ile ilgili basit bir örnek ekler.`,
      mustKnow: [`${TAG} Konunun adı: ${input.teacherTopic}`, ...input.outcomes.slice(0, 4).map((o) => `${TAG} ${o.code}`), `${TAG} Ders: ${input.subject}`].slice(0, 6),
    };
    const blank = { options: null, correctAnswer: null, correctBoolean: null, acceptableAnswers: null, pairs: null, items: null, correctOrder: null, sampleAnswer: null, rubric: null, context: null, imageDescription: null };
    const questions = Array.from({ length: input.questionCount }, (_, i) => {
      const code = codes[i % codes.length];
      const base = { ...blank, explanation: `${TAG} Açıklama`, points: 10, curriculumOutcomeCodes: [code] };
      if (i % 2 === 0) {
        return { ...base, type: "MULTIPLE_CHOICE", questionText: `${TAG} Soru ${i + 1} (${code})`, options: ["A seçeneği", "B seçeneği", "C seçeneği", "D seçeneği"], correctAnswer: "A seçeneği" };
      }
      return { ...base, type: "TRUE_FALSE", questionText: `${TAG} Soru ${i + 1} (${code}) doğru mu?`, correctBoolean: true };
    });
    const raw = input.scope === "ALL" ? { ...content, questions } : input.scope === "SUMMARY" ? content : { questions };
    return { raw };
  }
}
