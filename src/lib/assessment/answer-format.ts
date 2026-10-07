// Human-readable rendering of a stored student answer (teacher views only).

export function describeAnswer(type: string, data: unknown, answer: unknown): string {
  if (!answer || typeof answer !== "object") return "—";
  const d = data as Record<string, unknown>;
  const a = answer as Record<string, unknown>;
  if ("text" in a) return String(a.text).trim() || "—";
  if ("selectedIndex" in a) return (d.options as string[] | null)?.[a.selectedIndex as number] ?? "—";
  if ("value" in a) return a.value ? "Doğru" : "Yanlış";
  if (type === "MATCHING") {
    const pairs = d.pairs as { left: string }[];
    return (a.matches as (string | null)[]).map((m, i) => `${pairs[i]?.left} → ${m ?? "—"}`).join("; ");
  }
  if (type === "ORDERING") return (a.order as number[]).map((i) => (d.items as string[])[i]).join(" → ");
  return "—";
}

export const ATTEMPT_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "Devam Ediyor",
  PENDING_TEACHER_REVIEW: "Öğretmen Değerlendirmesi Bekleniyor",
  COMPLETED: "Tamamlandı",
  EXPIRED: "Süresi Geçti",
};

/** The correct / expected answer of a question, for the teacher's answer sheet. */
export function describeCorrectAnswer(type: string, data: unknown): { label: string; text: string } {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (type) {
    case "MULTIPLE_CHOICE":
    case "CONTEXT_BASED":
      return { label: "Doğru cevap", text: String(d.correctAnswer ?? "—") };
    case "TRUE_FALSE":
      return { label: "Doğru cevap", text: d.correctAnswer ? "Doğru" : "Yanlış" };
    case "FILL_IN_THE_BLANK": {
      const extra = (d.acceptableAnswers as string[] | undefined)?.filter(Boolean) ?? [];
      return { label: "Doğru cevap", text: [String(d.correctAnswer ?? "—"), ...extra].join(" / ") };
    }
    case "MATCHING":
      return { label: "Doğru eşleştirme", text: ((d.pairs as { left: string; right: string }[]) ?? []).map((p) => `${p.left} → ${p.right}`).join("; ") || "—" };
    case "ORDERING":
      return { label: "Doğru sıralama", text: ((d.correctOrder as number[]) ?? []).map((i) => (d.items as string[])[i]).join(" → ") || "—" };
    default:
      return { label: "Örnek / beklenen cevap", text: String(d.sampleAnswer ?? "—") };
  }
}

export type AnswerState = "CORRECT" | "INCORRECT" | "PARTIAL" | "PENDING" | "UNANSWERED" | "REVIEWED";

export function answerState(a: { reviewStatus: string; isCorrect: boolean | null; awardedPoints: number | null }, maxPoints: number): AnswerState {
  if (a.reviewStatus === "PENDING_REVIEW") return "PENDING";
  if (a.reviewStatus === "UNANSWERED") return "UNANSWERED";
  const pts = a.awardedPoints ?? 0;
  if (a.isCorrect === true || (maxPoints > 0 && pts >= maxPoints)) return "CORRECT";
  if (pts > 0) return "PARTIAL";
  return "INCORRECT";
}

export const ANSWER_STATE_LABELS: Record<AnswerState, string> = {
  CORRECT: "Doğru",
  INCORRECT: "Yanlış",
  PARTIAL: "Kısmen doğru",
  PENDING: "Değerlendirme bekliyor",
  UNANSWERED: "Boş bırakıldı",
  REVIEWED: "Öğretmen puanladı",
};
