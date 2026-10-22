import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "로타디 - 로스트아크 랜덤 타워 디펜스",
  description: "로스트아크 랜덤 타워 디펜스 (로타디)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#05070b",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Gothic+A1:wght@400;500;600;700;800&family=Noto+Serif+KR:wght@600;700;900&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
