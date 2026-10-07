export const statusLabel = (status: string) => (status === "PUBLISHED" ? "Yayında" : status === "DRAFT" ? "Taslak" : status);

export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(d);
