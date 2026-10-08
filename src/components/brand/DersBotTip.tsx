interface DersBotTipProps {
  title?: string;
  children: React.ReactNode;
  variant?: "info" | "success" | "warm";
  style?: React.CSSProperties;
}

export function DersBotTip({
  title = "DersBot İpucu",
  children,
  variant = "info",
  style,
}: DersBotTipProps) {
  const borderColor =
    variant === "success"
      ? "var(--ok-border, #a7f3d0)"
      : variant === "warm"
      ? "var(--brand-yellow, #f59e0b)"
      : "var(--accent-border, #bfdbfe)";

  const bgColor =
    variant === "success"
      ? "var(--ok-bg, #ecfdf5)"
      : variant === "warm"
      ? "var(--brand-yellow-light, #fef3c7)"
      : "var(--surface-subtle, #f0f9ff)";

  return (
    <div
      className="dersbot-tip-card"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 18px",
        borderRadius: "var(--radius-md, 12px)",
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        ...style,
      }}
      role="note"
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #2563eb",
          boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)",
          flexShrink: 0,
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/dersbot-mascot.jpg"
          alt="DersBot"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, fontSize: "0.9rem", lineHeight: 1.55 }}>
        {title && (
          <div
            style={{
              fontWeight: 700,
              color: "var(--brand-navy, #0f1e42)",
              fontSize: "0.85rem",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{title}</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "1px 6px",
                borderRadius: "9999px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              Rehber
            </span>
          </div>
        )}
        <div style={{ color: "var(--text, #0f172a)" }}>{children}</div>
      </div>
    </div>
  );
}
