// Server-side scoring. Objective types are scored here; open-ended types are sent to the teacher.
// Pure functions – no database access – so they are easy to test and cannot be influenced by
// anything the client sends except the answer itself.

import { isAnswered, type AnswerValue } from "./answer-schema.ts";

export interface ScorableQuestion {
  id: string;
  type: string;
  points: number;
  data: unknown;
}

export interface QuestionScore {
  questionId: string;
  reviewStatus: "AUTO_SCORED" | "PENDING_REVIEW" | "UNANSWERED";
  isCorrect: boolean | null;
  awardedPoints: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Turkish-aware normalisation: trim, collapse spaces, lower-case with the tr-TR locale. */
export function normalizeText(s: string) {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function scoreMultipleChoice(data: { options: string[]; correctAnswer: string }, answer: AnswerValue): boolean {
  return data.options[answer.selectedIndex as number] === data.correctAnswer;
}

export function scoreTrueFalse(data: { correctAnswer: boolean }, answer: AnswerValue): boolean {
  return answer.value === data.correctAnswer;
}

export function scoreFillBlank(data: { correctAnswer: string; acceptableAnswers?: string[] }, answer: AnswerValue): boolean {
  const given = normalizeText(String(answer.text ?? ""));
  return given.length > 0 && [data.correctAnswer, ...(data.acceptableAnswers ?? [])].some((a) => normalizeText(a) === given);
}

/** Fraction (0–1) of correctly matched pairs. */
export function scoreMatching(data: { pairs: { left: string; right: string }[] }, answer: AnswerValue): number {
  const m = answer.matches as (string | null)[];
  const correct = data.pairs.filter((p, i) => m[i] === p.right).length;
  return data.pairs.length ? correct / data.pairs.length : 0;
}

/** Fraction (0–1) of items in the correct position. */
export function scoreOrdering(data: { items: string[]; correctOrder: number[] }, answer: AnswerValue): number {
  const order = answer.order as number[];
  const correct = data.correctOrder.filter((idx, pos) => order[pos] === idx).length;
  return data.correctOrder.length ? correct / data.correctOrder.length : 0;
}

/** Whether a question is scored automatically (true) or by the teacher (false). */
export function isAutoScored(type: string, data: unknown): boolean {
  if (type === "CONTEXT_BASED") return Boolean((data as { options?: unknown }).options);
  return ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK", "MATCHING", "ORDERING"].includes(type);
}

export function scoreQuestion(q: ScorableQuestion, answer: AnswerValue | null): QuestionScore {
  if (!isAnswered(q.type, answer)) return { questionId: q.id, reviewStatus: "UNANSWERED", isCorrect: false, awardedPoints: 0 };
  if (!isAutoScored(q.type, q.data)) return { questionId: q.id, reviewStatus: "PENDING_REVIEW", isCorrect: null, awardedPoints: null };
  const d = q.data as never;
  let fraction: number;
  switch (q.type) {
    case "MULTIPLE_CHOICE":
    case "CONTEXT_BASED":
      fraction = scoreMultipleChoice(d, answer!) ? 1 : 0;
      break;
    case "TRUE_FALSE":
      fraction = scoreTrueFalse(d, answer!) ? 1 : 0;
      break;
    case "FILL_IN_THE_BLANK":
      fraction = scoreFillBlank(d, answer!) ? 1 : 0;
      break;
    case "MATCHING":
      fraction = scoreMatching(d, answer!);
      break;
    case "ORDERING":
      fraction = scoreOrdering(d, answer!);
      break;
    default:
      fraction = 0;
  }
  return { questionId: q.id, reviewStatus: "AUTO_SCORED", isCorrect: fraction === 1, awardedPoints: round2(q.points * fraction) };
}

/** 0–100, rounded to the nearest integer. */
export const toPercent = (earned: number, total: number) => (total > 0 ? Math.round((earned / total) * 100) : 0);

export interface AttemptTotals {
  totalPoints: number;
  earnedPoints: number;
  autoScore: number | null;
  manualScore: number | null;
  finalScore: number | null; // null while any answer awaits review
  correctCount: number;
  incorrectCount: number;
  pendingReview: number;
}

/** Aggregate per-answer results (auto + teacher-reviewed) into attempt scores. */
export function computeAttemptTotals(
  rows: { points: number; auto: boolean; reviewStatus: string; awardedPoints: number | null; isCorrect: boolean | null }[],
): AttemptTotals {
  const totalPoints = rows.reduce((n, r) => n + r.points, 0);
  const pendingReview = rows.filter((r) => r.reviewStatus === "PENDING_REVIEW").length;
  const sum = (xs: typeof rows) => xs.reduce((n, r) => n + (r.awardedPoints ?? 0), 0);
  const autoRows = rows.filter((r) => r.auto);
  const manualRows = rows.filter((r) => !r.auto && r.reviewStatus === "REVIEWED");
  const earnedPoints = round2(sum(rows));
  return {
    totalPoints,
    earnedPoints,
    autoScore: autoRows.length ? toPercent(sum(autoRows), autoRows.reduce((n, r) => n + r.points, 0)) : null,
    manualScore: manualRows.length ? toPercent(sum(manualRows), manualRows.reduce((n, r) => n + r.points, 0)) : null,
    finalScore: pendingReview ? null : toPercent(earnedPoints, totalPoints),
    correctCount: rows.filter((r) => r.isCorrect === true).length,
    incorrectCount: rows.filter((r) => r.isCorrect === false).length,
    pendingReview,
  };
}
