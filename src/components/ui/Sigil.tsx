/** 아크 문양: 동심원 + 눈금 + 겹친 사각 */
export default function Sigil({ className = "" }: { className?: string }) {
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor">
      <circle cx="100" cy="100" r="96" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="88" strokeWidth="0.4" />
      <circle cx="100" cy="100" r="62" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="30" strokeWidth="0.8" />
      {ticks.map((a) => (
        <line
          key={a}
          x1="100"
          y1={a % 30 === 0 ? 4 : 8}
          x2="100"
          y2="12"
          strokeWidth={a % 30 === 0 ? 1.2 : 0.5}
          transform={`rotate(${a} 100 100)`}
        />
      ))}
      <rect x="56" y="56" width="88" height="88" strokeWidth="0.6" transform="rotate(45 100 100)" />
      <rect x="56" y="56" width="88" height="88" strokeWidth="0.6" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx="100" cy="38" r="3" strokeWidth="0.7" transform={`rotate(${a} 100 100)`} />
      ))}
      <path d="M100 70 L108 100 L100 130 L92 100 Z" strokeWidth="0.8" />
    </svg>
  );
}
