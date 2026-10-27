"use client";

import { useRef, useState } from "react";
import Icon from "./Icon";
import { usePresence } from "./motion";

/**
 * 모달 — 데스크톱은 가운데 팝업, 모바일은 아래에서 올라오는 시트
 * 열 때 expo-out으로 올라오고 닫을 때 빠르게 내려감
 */
export function Modal({
  open,
  onClose,
  kicker,
  title,
  width = 440,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** 제목 위 작은 영문 라벨 (예: SHOP) */
  kicker?: string;
  title: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  const { mounted, closing } = usePresence(open, 220);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center">
      <div
        className={`absolute inset-0 bg-[#0a0e33]/70 ${
          closing ? "animate-fade-out" : "animate-fade-in"
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`frame relative max-h-[80vh] w-full overflow-y-auto rounded-b-none px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 lg:w-[var(--modal-w)] lg:rounded-[22px] lg:pb-4 ${
          closing ? "max-lg:animate-sheet-out lg:animate-pop-out" : "max-lg:animate-sheet-in lg:animate-pop-in"
        }`}
        style={{ "--modal-w": `${width}px` } as React.CSSProperties}
      >
        <div className="absolute left-1/2 top-1.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-line/50 lg:hidden" />
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {kicker && (
              <div className="font-display text-xs uppercase tracking-wider text-gold-300 text-toon-sm">{kicker}</div>
            )}
            <h3 className="font-display text-2xl leading-tight text-parchment-50 text-toon">{title}</h3>
          </div>
          <button className="btn-red h-9 w-9 shrink-0 rounded-full" onClick={onClose} aria-label="닫기">
            <Icon name="close" className="text-base" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * 마우스 툴팁 — position: fixed로 그려서 스크롤 영역이나 캔버스에 가려지지 않음
 * 오른쪽에 자리가 없으면 왼쪽에 표시
 */
export function Tip({
  tip,
  children,
  side = "right",
  className = "",
}: {
  tip: React.ReactNode;
  children: React.ReactNode;
  side?: "right" | "left" | "top";
  className?: string;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; origin: string } | null>(null);
  const W = 248;

  return (
    <div
      ref={anchorRef}
      className={className}
      onMouseEnter={() => {
        const r = anchorRef.current?.getBoundingClientRect();
        if (!r) return;
        if (side === "top") {
          setPos({
            left: Math.max(8, Math.min(r.left + r.width / 2 - W / 2, window.innerWidth - W - 8)),
            top: Math.max(8, r.top - 8),
            origin: "bottom",
          });
          return;
        }
        const fitsRight = r.right + 10 + W < window.innerWidth;
        const goRight = side === "right" ? fitsRight : r.left - 10 - W < 0;
        setPos({
          left: goRight ? r.right + 10 : r.left - 10 - W,
          top: Math.max(8, Math.min(r.top, window.innerHeight - 340)),
          origin: goRight ? "left" : "right",
        });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          className="pointer-events-none fixed z-[90]"
          style={{
            left: pos.left,
            top: pos.top,
            width: W,
            transform: pos.origin === "bottom" ? "translateY(-100%)" : undefined,
          }}
        >
          <div
            className="frame animate-pop-in rounded-2xl p-3 text-[12px] leading-relaxed text-parchment-300"
            style={{
              transformOrigin: pos.origin === "bottom" ? "bottom center" : `${pos.origin} top`,
            }}
          >
            {tip}
          </div>
        </div>
      )}
    </div>
  );
}
