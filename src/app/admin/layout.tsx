import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user.ts";
import { LogoutButton } from "@/components/LogoutButton.tsx";
import { DersBotLogo } from "@/components/brand/DersBotLogo.tsx";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Genel Bakış",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    href: "/admin/ogretmenler",
    label: "Öğretmenler",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/ogrenciler",
    label: "Öğrenciler",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    href: "/admin/kullanicilar",
    label: "Tüm Kullanıcılar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M6 19.5a7 7 0 0 1 12 0" />
      </svg>
    ),
  },
  {
    href: "/admin/siniflar",
    label: "Sınıflar",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/admin/gorevler",
    label: "Görevler",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/kullanim-limitleri",
    label: "Kullanım Limitleri",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 12 19 5" />
        <path d="M12 6v6h6" />
      </svg>
    ),
  },
  {
    href: "/admin/davet-kodlari",
    label: "Davet Kodları",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="12" x="3" y="6" rx="2" />
        <path d="M3 12h18" />
        <path d="M8 6v12" />
      </svg>
    ),
  },
  {
    href: "/admin/ai-durumu",
    label: "AI Durumu",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <rect width="6" height="6" x="9" y="9" rx="1" />
        <path d="M15 2v2" />
        <path d="M15 20v2" />
        <path d="M2 15h2" />
        <path d="M2 9h2" />
        <path d="M20 15h2" />
        <path d="M20 9h2" />
        <path d="M9 2v2" />
        <path d="M9 20v2" />
      </svg>
    ),
  },
  {
    href: "/admin/mufredat",
    label: "MEB Müfredat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </svg>
    ),
  },
  {
    href: "/admin/ayarlar",
    label: "Sistem Ayarları",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: "/admin/islem-gecmisi",
    label: "İşlem Geçmişi",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg)" }}>
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
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <DersBotLogo href="/admin" size="sm" />
          <span className="muted" style={{ fontWeight: 500, fontSize: "0.85rem", borderLeft: "1px solid var(--border)", paddingLeft: 10 }}>
            Yönetim Masası
          </span>
          <span
            className="badge"
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              backgroundColor: "var(--crimson-light)",
              color: "var(--crimson)",
              borderColor: "transparent",
              letterSpacing: "0.04em",
            }}
          >
            SİSTEM YÖNETİCİSİ
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
            <strong>{admin.name}</strong> <span className="muted" style={{ fontSize: "0.82rem" }}>({admin.email})</span>
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
            borderRight: "1px solid var(--border)",
            padding: "20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ padding: "0 10px 10px", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
                borderRadius: "var(--radius-xs)",
                fontSize: "0.88rem",
                color: "var(--ink)",
                textDecoration: "none",
                fontWeight: 500,
                transition: "background 0.15s ease",
              }}
              className="admin-nav-link"
            >
              <span style={{ color: "var(--muted)", display: "flex", alignItems: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </aside>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            maxWidth: 1240,
            padding: "28px 32px 80px",
            margin: "0",
            minWidth: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
