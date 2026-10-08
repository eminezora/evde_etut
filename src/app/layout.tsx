import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Mascot } from "@/components/Mascot.tsx";

const description = "MEB öğrenme çıktılarına tam uyumlu yapay zekâ destekli derse hazırlık ve öğrenme robotu";

export const metadata: Metadata = {
  title: {
    default: "DersBot – Akıllı Derse Hazırlık Platformu",
    template: "%s · DersBot",
  },
  description,
  icons: {
    icon: "/brand/dersbot-mascot.jpg",
    apple: "/brand/dersbot-mascot.jpg",
  },
  openGraph: {
    title: "DersBot – Akıllı Derse Hazırlık Platformu",
    description,
    siteName: "DersBot",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "DersBot – Akıllı Derse Hazırlık Platformu",
    description,
  },
};

// Light-only design: native controls (date picker, selects) render light too.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#2563eb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Mascot />
      </body>
    </html>
  );
}
