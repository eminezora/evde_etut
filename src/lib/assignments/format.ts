export const statusLabel = (status: string) => (status === "PUBLISHED" ? "Yayında" : status === "DRAFT" ? "Taslak" : status);

export const formatDate = (d: Date | string | number) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(
    typeof d === "object" ? d : new Date(d)
  );
