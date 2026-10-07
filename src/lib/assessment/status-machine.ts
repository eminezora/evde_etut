// StudentAssignment status transitions. The only place that decides which status may follow
// which; services call `transition()` and never write a status the client asked for.

export const STUDENT_STATUSES = [
  "NOT_STARTED",
  "READING",
  "READY_FOR_ASSESSMENT",
  "ASSESSMENT_IN_PROGRESS",
  "PENDING_TEACHER_REVIEW",
  "NEEDS_REVIEW",
  "READY_FOR_CLASS",
  "EXPIRED",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

const ALLOWED: Record<StudentStatus, StudentStatus[]> = {
  NOT_STARTED: ["READING", "EXPIRED"],
  READING: ["READY_FOR_ASSESSMENT", "EXPIRED"],
  READY_FOR_ASSESSMENT: ["ASSESSMENT_IN_PROGRESS", "EXPIRED"],
  ASSESSMENT_IN_PROGRESS: ["READY_FOR_CLASS", "NEEDS_REVIEW", "PENDING_TEACHER_REVIEW", "EXPIRED"],
  // Open answers are graded by the teacher even after the deadline – no EXPIRED here.
  PENDING_TEACHER_REVIEW: ["READY_FOR_CLASS", "NEEDS_REVIEW"],
  // Retry starts a new attempt directly.
  NEEDS_REVIEW: ["ASSESSMENT_IN_PROGRESS", "EXPIRED"],
  READY_FOR_CLASS: [],
  EXPIRED: [],
};

export class TransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Geçersiz durum geçişi: ${from} → ${to}`);
  }
}

export const canTransition = (from: string, to: StudentStatus) => (ALLOWED[from as StudentStatus] ?? []).includes(to);

/** Returns `to` if the transition is allowed, otherwise throws. */
export function transition(from: string, to: StudentStatus): StudentStatus {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
  return to;
}

/** Statuses that turn into EXPIRED once the deadline has passed. */
export const EXPIRABLE: StudentStatus[] = ["NOT_STARTED", "READING", "READY_FOR_ASSESSMENT", "ASSESSMENT_IN_PROGRESS", "NEEDS_REVIEW"];

export const STATUS_LABELS: Record<StudentStatus, string> = {
  NOT_STARTED: "Başlamadı",
  READING: "Özet Okunuyor",
  READY_FOR_ASSESSMENT: "Ön Bilgi Kontrolüne Hazır",
  ASSESSMENT_IN_PROGRESS: "Ön Bilgi Kontrolü Sürüyor",
  PENDING_TEACHER_REVIEW: "Öğretmen Değerlendirmesi Bekleniyor",
  NEEDS_REVIEW: "Tekrar Gerekli",
  READY_FOR_CLASS: "Derse Hazır",
  EXPIRED: "Süresi Geçti",
};

/** Stepper position 0–4 (Giriş, Özet, Okudum, Ön Bilgi Kontrolü, Sonuç) reached so far. */
export function stepIndex(status: string): number {
  switch (status) {
    case "NOT_STARTED":
      return 0;
    case "READING":
      return 1;
    case "READY_FOR_ASSESSMENT":
      return 3;
    case "ASSESSMENT_IN_PROGRESS":
      return 3;
    default:
      return 4;
  }
}
