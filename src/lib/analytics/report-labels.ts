// Status names for the teacher analytics views. Kept free of server imports so client components
// can use them. Wording matches STATUS_LABELS in src/lib/assessment/status-machine.ts.

export type ReportStatus = "READY" | "NEEDS_REVIEW" | "PENDING_REVIEW" | "IN_PROGRESS" | "NOT_STARTED" | "EXPIRED";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  READY: "Derse Hazır",
  NEEDS_REVIEW: "Tekrar Gerekli",
  PENDING_REVIEW: "Öğretmen Değerlendirmesi Bekleniyor",
  IN_PROGRESS: "Tamamlamadı",
  NOT_STARTED: "Başlamadı",
  EXPIRED: "Süresi Geçti",
};
