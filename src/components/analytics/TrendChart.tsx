// Readiness rate over the classroom's assignments in one subject: a 2px line with ≥8px markers,
// one value label on the latest point; all values are also listed as text below.
export function TrendChart({ points }: { points: { label: string; topic: string; readinessRate: number }[] }) {
  const W = 560;
  const H = 160;
  const pad = { l: 36, r: 16, t: 14, b: 28 };
  const x = (i: number) => pad.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const last = points[points.length - 1];
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Hazırlık oranı eğilimi: ${points.map((p) => `${p.label} %${p.readinessRate}`).join(", ")}`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="trend-grid" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="trend-axis">%{v}</text>
          </g>
        ))}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.readinessRate)}`).join(" ")} className="trend-line" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.readinessRate)} r={4.5} className="trend-dot">
              <title>{`${p.label} – ${p.topic}: %${p.readinessRate}`}</title>
            </circle>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="trend-axis">{p.label}</text>
          </g>
        ))}
        <text x={x(points.length - 1)} y={y(last.readinessRate) - 10} textAnchor="middle" className="trend-value">%{last.readinessRate}</text>
      </svg>
      <figcaption>
        <ul className="trend-list">
          {points.map((p) => <li key={p.label}>{p.label} ({p.topic}): <strong>%{p.readinessRate}</strong></li>)}
        </ul>
      </figcaption>
    </figure>
  );
}
