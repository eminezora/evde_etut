import type { Metadata, Viewport } from "next";
import "./globals.css";

const description = "MEB öğrenme çıktılarına bağlı derse hazırlık görevleri";

export const metadata: Metadata = {
  title: "Evde Etüt",
  description,
  // Link previews (WhatsApp, Slack, social) read these tags.
  openGraph: { title: "Evde Etüt", description, siteName: "Evde Etüt", locale: "tr_TR", type: "website" },
  twitter: { card: "summary", title: "Evde Etüt", description },
};

// Light-only design: native controls (date picker, selects) render light too.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
