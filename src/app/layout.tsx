import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Evde Etüt", description: "MEB öğrenme çıktılarına bağlı derse hazırlık görevleri" };

// Light-only design: native controls (date picker, selects) render light too.
export const viewport: Viewport = { colorScheme: "light", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
