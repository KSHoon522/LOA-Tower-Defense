"use client";

import { useEffect, useState } from "react";
import type { Appearance } from "@/game/types";

/** 이미지 주소별 로드 실패 기록 (같은 엠블럼을 여러 곳에서 써도 한 번만 확인) */
const failed = new Set<string>();
const checked = new Set<string>();

function useImageOk(src?: string): boolean {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!src || checked.has(src)) return;
    checked.add(src);
    const img = new Image();
    img.onerror = () => {
      failed.add(src);
      rerender((n) => n + 1);
    };
    img.src = src;
  }, [src]);
  return !!src && !failed.has(src);
}

/**
 * 직업 엠블럼
 * - appearance.image(투명 배경의 흰 실루엣 PNG)를 마스크로 써서 글자색(currentColor)으로 칠함
 *   → 부모의 text-* 색만 바꿔 선택/비선택 상태를 표현
 * - 이미지가 없거나 불러오지 못하면 이모지(icon)
 */
export default function JobEmblem({
  appearance,
  size,
  glow,
  className = "",
}: {
  appearance?: Appearance;
  size: number;
  /** 바깥 광채 색 (선택 강조 등) */
  glow?: string;
  className?: string;
}) {
  const src = appearance?.image;
  const ok = useImageOk(src);
  // 마스크된 요소에 직접 filter를 주면 그림자가 마스크에 잘리므로 바깥 요소에 적용
  const filter = [glow && `drop-shadow(0 0 ${Math.round(size / 5)}px ${glow})`, "drop-shadow(0 1px 1.5px rgba(0,0,0,0.85))"]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{ width: size, height: size, filter }}
    >
      {ok ? (
        <span
          className="block h-full w-full bg-current"
          style={{
            WebkitMask: `url("${src}") center / contain no-repeat`,
            mask: `url("${src}") center / contain no-repeat`,
          }}
        />
      ) : (
        <span style={{ fontSize: size * 0.8 }}>{appearance?.icon ?? "✨"}</span>
      )}
    </span>
  );
}
