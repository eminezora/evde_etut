import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";

const NAV_ITEMS = [
  { href: "/admin", label: "Genel Bakış", icon: "📊" },
  { href: "/admin/ogretmenler", label: "Öğretmenler", icon: "👨‍🏫" },
  { href: "/admin/ogrenciler", label: "Öğrenciler", icon: "🎓" },
  { href: "/admin/kullanicilar", label: "Tüm Kullanıcılar", icon: "👥" },
  { href: "/admin/siniflar", label: "Sınıflar", icon: "🏫" },
  { href: "/admin/gorevler", label: "Görevler", icon: "📋" },
  { href: "/admin/davet-kodlari", label: "Davet Kodları", icon: "🎟️" },
  { href: "/admin/ai-durumu", label: "AI Durumu", icon: "🤖" },
  { href: "/admin/mufredat", label: "MEB Müfredat", icon: "📖" },
  { href: "/admin/ayarlar", label: "Sistem Ayarları", icon: "⚙️" },
  { href: "/admin/islem-gecmisi", label: "İşlem Geçmişi", icon: "📜" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#f8fafc" }}>
      {/* Top Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: 60,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🛡️</span>
            <span>Evde Etüt <span style={{ color: "#64748b", fontWeight: 500, fontSize: "0.9rem" }}>Yönetim Portalı</span></span>
          </Link>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "9999px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              letterSpacing: "0.04em",
            }}
          >
            ADMIN PANELİ
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: "0.85rem", color: "#334155" }}>
            <strong>{admin.name}</strong> <span style={{ color: "#94a3b8" }}>({admin.email})</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Two-column layout: Operational Sidebar + Main Content */}
      <div style={{ display: "flex", flex: 1, minHeight: "calc(100vh - 60px)" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #e2e8f0",
            padding: "20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ padding: "0 10px 10px", fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            YÖNETİM MENÜSÜ
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "0.88rem",
                color: "#334155",
                textDecoration: "none",
                fontWeight: 500,
                transition: "background 0.15s ease",
              }}
              className="admin-nav-link"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </aside>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            maxWidth: 1200,
            padding: "28px 32px 80px",
            margin: "0",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
