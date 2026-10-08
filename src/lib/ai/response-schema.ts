// Two layers of schema for AI output:
//  1. `wire*Schema` – the JSON shape requested from the model via structured outputs. Kept flat and
//     simple (nullable type-specific fields) so it fits the structured-output JSON-schema subset.
//  2. `parseGeneratedContent` – normalises that shape and validates it with the strict schemas used
//     everywhere else. Nothing reaches the database unless step 2 succeeds.

import { z } from "zod";
import { QUESTION_TYPES, questionSchema, type ValidQuestion } from "../content/question-schema.ts";
import { studyContentSchema, type ValidStudyContent } from "../content/study-content-schema.ts";

export const GENERATION_SCOPES = ["ALL", "SUMMARY", "QUESTIONS"] as const;
export type GenerationScope = (typeof GENERATION_SCOPES)[number];

const wireQuestion = z.object({
  type: z.enum(QUESTION_TYPES),
  questionText: z.string(),
  options: z.array(z.string()).nullable(),
  correctAnswer: z.string().nullable(),
  correctBoolean: z.boolean().nullable(),
  acceptableAnswers: z.array(z.string()).nullable(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).nullable(),
  items: z.array(z.string()).nullable(),
  correctOrder: z.array(z.number().int()).nullable(),
  sampleAnswer: z.string().nullable(),
  rubric: z.string().nullable(),
  context: z.string().nullable(),
  imageDescription: z.string().nullable(),
  explanation: z.string().nullable(),
  points: z.number().int(),
  curriculumOutcomeCodes: z.array(z.string()),
});

const wireContent = {
  introduction: z.string(),
  keyConcepts: z.array(z.object({ term: z.string(), explanation: z.string() })),
  summary: z.string(),
  simpleExample: z.string(),
  mustKnow: z.array(z.string()),
};

export const wireSchemas = {
  ALL: z.object({ ...wireContent, questions: z.array(wireQuestion) }),
  SUMMARY: z.object(wireContent),
  QUESTIONS: z.object({ questions: z.array(wireQuestion) }),
} as const;

type WireQuestion = z.infer<typeof wireQuestion>;

/** Pick only the fields that belong to the question's type (no values are invented). */
function normaliseQuestion(q: WireQuestion): unknown {
  const common = {
    type: q.type,
    questionText: q.questionText,
    explanation: q.explanation,
    points: q.points,
    curriculumOutcomeCodes: q.curriculumOutcomeCodes,
  };
  switch (q.type) {
    case "MULTIPLE_CHOICE": {
      const options = q.options ?? [];
      let correctAnswer = q.correctAnswer;
      if (options.length > 0 && typeof correctAnswer === "string") {
        const trimmedAns = correctAnswer.trim();
        if (!options.includes(trimmedAns)) {
          // 1. Check letter index (A -> index 0, B -> index 1, etc.)
          const cleanLetter = trimmedAns.toUpperCase().replace(/[).:\s]/g, "");
          const letters = ["A", "B", "C", "D", "E", "F"];
          const letterIdx = letters.indexOf(cleanLetter);
          if (letterIdx >= 0 && letterIdx < options.length) {
            correctAnswer = options[letterIdx];
          } else {
            // 2. Check if an option has prefix like "A) " and matches trimmedAns without prefix
            const strippedMatch = options.find((opt) => {
              const stripped = opt.replace(/^[A-Fa-f][).:\s]+/, "").trim();
              return stripped.toLowerCase() === trimmedAns.toLowerCase();
            });
            if (strippedMatch) {
              correctAnswer = strippedMatch;
            } else {
              // 3. Check if trimmedAns has prefix and matches option without prefix
              const ansStripped = trimmedAns.replace(/^[A-Fa-f][).:\s]+/, "").trim();
              const optMatch = options.find((opt) => opt.trim().toLowerCase() === ansStripped.toLowerCase());
              if (optMatch) {
                correctAnswer = optMatch;
              } else {
                // 4. Substring or endsWith match
                const subMatch = options.find((opt) => {
                  const o = opt.trim().toLowerCase();
                  const a = trimmedAns.toLowerCase();
                  return o.endsWith(a) || o.includes(a);
                });
                if (subMatch) {
                  correctAnswer = subMatch;
                }
              }
            }
          }
        }
      }
      return { ...common, options, correctAnswer };
    }
    case "TRUE_FALSE":
      return { ...common, correctAnswer: q.correctBoolean };
    case "FILL_IN_THE_BLANK":
      return { ...common, correctAnswer: q.correctAnswer, acceptableAnswers: q.acceptableAnswers ?? [] };
    case "MATCHING":
      return { ...common, pairs: q.pairs };
    case "ORDERING":
      return { ...common, items: q.items, correctOrder: q.correctOrder };
    case "SHORT_ANSWER":
      return { ...common, sampleAnswer: q.sampleAnswer };
    case "LONG_ANSWER":
      return { ...common, sampleAnswer: q.sampleAnswer, rubric: q.rubric };
    case "CONTEXT_BASED":
      return { ...common, context: q.context, options: q.options, correctAnswer: q.correctAnswer };
    case "IMAGE_INTERPRETATION":
      return { ...common, imageDescription: q.imageDescription, imageUrl: null, sampleAnswer: q.sampleAnswer };
  }
}

export interface GeneratedPreparationContent {
  content: ValidStudyContent | null;
  questions: ValidQuestion[] | null;
}

export type ParseResult = { ok: true; value: GeneratedPreparationContent } | { ok: false; issues: string[] };

/**
 * Validate raw provider output for a scope. `issues` only contains schema paths and messages –
 * never the model's text – so it is safe to log.
 */
export function parseGeneratedContent(
  scope: GenerationScope,
  raw: unknown,
  { questionCount, allowedOutcomeCodes }: { questionCount: number; allowedOutcomeCodes: string[] },
): ParseResult {
  const wire = wireSchemas[scope].safeParse(raw);
  if (!wire.success) return { ok: false, issues: wire.error.issues.map((i) => `wire:${i.path.join(".")}: ${i.message}`) };
  const data = wire.data as Partial<z.infer<typeof wireSchemas.ALL>>;
  const issues: string[] = [];

  let content: ValidStudyContent | null = null;
  if (scope !== "QUESTIONS") {
    const parsed = studyContentSchema.safeParse({
      introduction: data.introduction,
      keyConcepts: data.keyConcepts,
      summary: data.summary,
      simpleExample: data.simpleExample,
      mustKnow: data.mustKnow,
    });
    if (parsed.success) {
      content = parsed.data;
      if (!content.introduction && !content.summary) issues.push("content: introduction ve summary boş");
      if (content.keyConcepts.length < 1) issues.push("content.keyConcepts: en az 1 kavram gerekli");
      if (content.mustKnow.length < 3) issues.push("content.mustKnow: en az 3 madde gerekli");
    } else issues.push(...parsed.error.issues.map((i) => `content.${i.path.join(".")}: ${i.message}`));
  }

  let questions: ValidQuestion[] | null = null;
  if (scope !== "SUMMARY") {
    const list = data.questions ?? [];
    // If model generated more questions than requested, safely take the requested count
    const targetList = list.length > questionCount ? list.slice(0, questionCount) : list;
    if (targetList.length !== questionCount) issues.push(`questions: ${questionCount} soru bekleniyordu, ${targetList.length} geldi`);
    const allowed = new Set(allowedOutcomeCodes);
    questions = [];
    targetList.forEach((q, i) => {
      // Normalise minor formatting variations in outcome codes (e.g. whitespace, trailing dot, uppercase)
      const rawCodes = q.curriculumOutcomeCodes ?? [];
      const normalizedCodes = rawCodes.map((c) => {
        if (allowed.has(c)) return c;
        const clean = c.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const matched = allowedOutcomeCodes.find((a) => a.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === clean);
        if (matched) return matched;
        const prefixMatched = allowedOutcomeCodes.find((a) => a.startsWith(c) || c.startsWith(a));
        if (prefixMatched) return prefixMatched;
        return c;
      });

      const parsed = questionSchema.safeParse(normaliseQuestion({ ...q, curriculumOutcomeCodes: normalizedCodes }));
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((x) => `questions.${i}.${x.path.join(".")}: ${x.message}`));
        return;
      }
      // Grounding: a question may only cite the outcomes the teacher selected.
      const unknown = parsed.data.curriculumOutcomeCodes.filter((c) => !allowed.has(c));
      if (unknown.length) issues.push(`questions.${i}.curriculumOutcomeCodes: seçilmemiş kod (${unknown.join(", ")})`);
      if (parsed.data.curriculumOutcomeCodes.length === 0) issues.push(`questions.${i}.curriculumOutcomeCodes: en az 1 kod gerekli`);
      questions!.push(parsed.data);
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: { content, questions } };
}
