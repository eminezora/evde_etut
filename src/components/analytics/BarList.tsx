// Horizontal single-hue bar list. Every value is printed as text next to its bar, so the bars are
// decorative (aria-hidden) and the list reads correctly without colour or hover.
export interface BarItem {
  key: string;
  label: React.ReactNode;
  value: number | null; // drawn length
  max: number;
  display: string; // text shown and read out
  hint?: string; // native hover title
}

export function BarList({ items, caption }: { items: BarItem[]; caption: string }) {
  return (
    <figure className="barlist">
      <figcaption className="sr-only">{caption}</figcaption>
      <ul>
        {items.map((it) => (
          <li key={it.key} title={it.hint}>
            <span className="barlist-label">{it.label}</span>
            <span className="barlist-track" aria-hidden="true">
              {it.value !== null && it.value > 0 && <span className="barlist-bar" style={{ width: `${Math.max(1, (it.value / it.max) * 100)}%` }} />}
            </span>
            <span className="barlist-value">{it.display}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
