import Link from "next/link";

/** 에디터 전용 레이아웃 — 게임 화면(로비/전투)에는 개발용 내비게이션을 두지 않음 */
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-arkesia">
      <header className="sticky top-0 z-40 border-b border-gold-500/15 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-serif text-lg font-black text-gold-grad">
            로타디
          </Link>
          <nav className="flex gap-4 text-sm text-parchment-300">
            <Link href="/" className="transition hover:text-gold-300">
              ← 로비
            </Link>
            <Link href="/editor" className="transition hover:text-gold-300">
              데이터 에디터
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
    </div>
  );
}
