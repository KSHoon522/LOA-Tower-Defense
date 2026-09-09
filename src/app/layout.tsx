import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <header className="border-b border-slate-800 bg-slate-900/60">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-amber-400">
              ⚔️ 로타디
            </Link>
            <nav className="flex gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-amber-400">
                게임
              </Link>
              <Link href="/editor" className="hover:text-amber-400">
                데이터 에디터
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
