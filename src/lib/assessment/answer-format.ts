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
