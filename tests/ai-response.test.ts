import { describe, expect, it } from "vitest";
import { parseGeneratedContent } from "../src/lib/ai/response-schema.ts";
import { QUESTION_TYPES, toStudentQuestion, toQuestionRow } from "../src/lib/content/question-schema.ts";

const blank = { options: null, correctAnswer: null, correctBoolean: null, acceptableAnswers: null, pairs: null, items: null, correctOrder: null, sampleAnswer: null, rubric: null, context: null, imageDescription: null };
const q = (type: string, fields: Record<string, unknown>) => ({ ...blank, type, questionText: `${type} sorusu`, explanation: "a", points: 10, curriculumOutcomeCodes: ["MAT.5.1.1"], ...fields });

const allTypes = [
  q("MULTIPLE_CHOICE", { options: ["1", "2", "3", "4"], correctAnswer: "2" }),
  q("TRUE_FALSE", { correctBoolean: false }),
  q("FILL_IN_THE_BLANK", { correctAnswer: "on" }),
  q("MATCHING", { pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] }),
  q("ORDERING", { items: ["c", "a", "b"], correctOrder: [1, 2, 0] }),
  q("SHORT_ANSWER", { sampleAnswer: "kısa" }),
  q("LONG_ANSWER", { sampleAnswer: "uzun" }),
  q("CONTEXT_BASED", { context: "Bir market…", correctAnswer: "12" }),
  q("IMAGE_INTERPRETATION", { imageDescription: "Bir sayı doğrusu", sampleAnswer: "5" }),
];
const content = { introduction: "Giriş", keyConcepts: [{ term: "Basamak", explanation: "…" }], summary: "Özet", simpleExample: "Örnek", mustKnow: ["1", "2", "3"] };
const opts = { questionCount: 9, allowedOutcomeCodes: ["MAT.5.1.1"] };

describe("AI response validation", () => {
  it("accepts all 9 question types", () => {
    expect(QUESTION_TYPES).toHaveLength(9);
    const res = parseGeneratedContent("ALL", { ...content, questions: allTypes }, opts);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.questions!.map((x) => x.type)).toEqual([...QUESTION_TYPES]);
  });

  it("rejects missing type fields, wrong counts, wrong answers and unknown outcome codes", () => {
    const cases = [
      [q("MULTIPLE_CHOICE", { options: ["1", "2"], correctAnswer: "3" })],
      [q("TRUE_FALSE", {})],
      [q("ORDERING", { items: ["a", "b"], correctOrder: [0, 0] })],
      [q("MATCHING", { pairs: null })],
      [q("SHORT_ANSWER", { sampleAnswer: "x", curriculumOutcomeCodes: ["FB.5.1.1"] })],
      [q("SHORT_ANSWER", { sampleAnswer: "x", curriculumOutcomeCodes: [] })],
    ];
    for (const questions of cases) expect(parseGeneratedContent("QUESTIONS", { questions }, { ...opts, questionCount: 1 }).ok).toBe(false);
    expect(parseGeneratedContent("ALL", { ...content, questions: allTypes.slice(0, 8) }, opts).ok).toBe(false);
    expect(parseGeneratedContent("SUMMARY", { ...content, mustKnow: ["sadece bir"] }, opts).ok).toBe(false);
    expect(parseGeneratedContent("SUMMARY", "not json", opts).ok).toBe(false);
  });

  it("hides answers in the student view for every type", () => {
    const res = parseGeneratedContent("QUESTIONS", { questions: allTypes }, opts);
    if (!res.ok) throw new Error(res.issues.join());
    for (const [i, valid] of res.value.questions!.entries()) {
      const { data, ...row } = toQuestionRow(valid);
      const view = toStudentQuestion({ id: String(i), ...row, data });
      expect(JSON.stringify(view)).not.toMatch(/correctAnswer|correctOrder|sampleAnswer|correctBoolean|"pairs"/);
    }
  });
});
