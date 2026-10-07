import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Ödev Takip", description: "MEB öğrenme çıktılarına bağlı görev oluşturma" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
