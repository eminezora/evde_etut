import Link from "next/link";

interface DersBotLogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  showSubtitle?: boolean;
  className?: string;
}

export function DersBotLogo({
  size = "md",
  href = "/",
  showSubtitle = false,
  className = "",
}: DersBotLogoProps) {
  const iconSize = size === "sm" ? 32 : size === "lg" ? 48 : 38;
  const textSize = size === "sm" ? "1.1rem" : size === "lg" ? "1.55rem" : "1.25rem";

  const content = (
    <div
      className={`dersbot-brand-lockup ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #2563eb",
          boxShadow: "0 2px 8px rgba(37, 99, 235, 0.22)",
          flexShrink: 0,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/dersbot-mascot.jpg"
          alt="DersBot Logo"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span
            style={{
              fontSize: textSize,
              fontWeight: 800,
              color: "var(--brand-navy, #0f1e42)",
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-sans)",
            }}
          >
            Ders<span style={{ color: "var(--brand-blue, #2563eb)" }}>Bot</span>
          </span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "var(--brand-yellow, #f59e0b)",
              display: "inline-block",
              marginLeft: 2,
            }}
          />
        </div>
        {showSubtitle && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted, #64748b)",
              fontWeight: 500,
              letterSpacing: "0.01em",
            }}
          >
            Akıllı Eğitim Platformu
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }}>
        {content}
      </Link>
    );
  }

  return content;
}
