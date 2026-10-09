// Small usage indicator: label, "7 / 10 kullanım kaldı", a thin bar and when it resets.
// Plain markup (no hooks), so server and client components can both render it.

export interface UsageMeterData {
  feature: string;
  label: string;
  unit: string;
  unlimited: boolean;
  limit: number;
  used: number;
  remaining: number | null;
  periodLabel: string;
  resetHint: string;
  source?: string;
}

export function UsageMeter({ q, compact = false }: { q: UsageMeterData; compact?: boolean }) {
  const pct = q.unlimited || q.limit === 0 ? 0 : Math.min(100, Math.round(((q.remaining ?? 0) / q.limit) * 100));
  const empty = !q.unlimited && (q.remaining ?? 0) === 0;
  return (
    <div className={`usage-meter${compact ? " compact" : ""}${empty ? " is-empty" : ""}`}>
      <div className="usage-meter-top">
        <span className="usage-meter-label">{q.label}</span>
        <span className="usage-meter-count">
          {q.unlimited ? "Sınırsız" : `${q.remaining} / ${q.limit} ${q.unit} kaldı`}
        </span>
      </div>
      {!q.unlimited && (
        <div className="usage-meter-bar" role="progressbar" aria-label={`${q.label} kalan hak`} aria-valuemin={0} aria-valuemax={q.limit} aria-valuenow={q.remaining ?? 0}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className="usage-meter-note">
        {q.unlimited ? "Bu özellik için kullanım sınırı yok" : `${q.periodLabel} kota · ${q.resetHint}`}
        {q.source === "OVERRIDE" ? " · size özel limit" : ""}
      </span>
    </div>
  );
}

/** Serialize a server QuotaStatus for client components. */
export function toMeterData(q: { feature: string; label: string; unit: string; unlimited: boolean; limit: number; used: number; remaining: number | null; periodLabel: string; resetHint: string; source: string }): UsageMeterData {
  return { feature: q.feature, label: q.label, unit: q.unit, unlimited: q.unlimited, limit: q.limit, used: q.used, remaining: q.remaining, periodLabel: q.periodLabel, resetHint: q.resetHint, source: q.source };
}
