"use client";

import { useState } from "react";
import { GRADE_BG, GRADE_COLOR } from "@/game/constants";
import type { Appearance, Grade } from "@/game/types";

/** 적/특수 슬롯용 팔레트 */
export const FOE_PALETTE = { color: "#ff6b72", bg: ["#8a1c2e", "#e2475a"] as [string, string] };
export const BOSS_PALETTE = { color: "#ff9a3c", bg: ["#6e0f24", "#c81e3a"] as [string, string] };

/**
 * 카툰 카드 칸: 굵은 외곽선 + 등급색 그라데이션 + 등급색 안쪽 테두리
 * - 스프라이트 시트가 있으면 대기 동작 첫 프레임, 이미지가 있으면 이미지, 없으면 이모지
 */
export default function GradeSlot({
  grade,
  palette,
  appearance,
  size = 56,
  selected = false,
  dashed = false,
  dim = false,
  className = "",
  children,
}: {
  grade?: Grade;
  palette?: { color: string; bg: [string, string] };
  appearance?: Appearance;
  size?: number;
  selected?: boolean;
  /** 합성 후보 등 점선 강조 */
  dashed?: boolean;
  dim?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const color = palette?.color ?? (grade ? GRADE_COLOR[grade] : "#a5b2ec");
  const [bg0, bg1] = palette?.bg ?? (grade ? GRADE_BG[grade] : ["#223088", "#3a4fb8"]);
  const radius = Math.max(8, Math.round(size * 0.22));
  const lineW = size >= 40 ? 3 : 2;

  return (
    <div
      className={`relative shrink-0 overflow-hidden transition duration-200 ease-spring ${
        dim ? "opacity-45 saturate-50" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        border: `${lineW}px solid #1b1438`,
        background: `linear-gradient(180deg, ${bg1} 0%, ${bg0} 100%)`,
        boxShadow: [
          `inset 0 0 0 2px ${color}`,
          "inset 0 -5px 0 rgba(0,0,0,0.2)",
          selected ? `0 0 0 3px #ffe266, 0 0 16px 2px rgba(255,226,102,0.7)` : `0 ${lineW}px 0 #1b1438`,
        ].join(", "),
      }}
    >
      {/* 윗부분 광택 */}
      <div
        className="pointer-events-none absolute inset-x-[3px] top-[3px] h-[38%] bg-white/20"
        style={{ borderRadius: `${radius - 4}px ${radius - 4}px 40% 40%` }}
      />
      {dashed && (
        <div
          className="pointer-events-none absolute inset-[3px] animate-pulse border-[3px] border-dashed border-gold-300"
          style={{ borderRadius: radius - 4 }}
        />
      )}
      <Portrait appearance={appearance} size={size - lineW * 2} />
      {/* 등급 보석 */}
      {grade && (
        <div
          className="pointer-events-none absolute left-1 top-1 h-2 w-2 rotate-45 rounded-[2px] border-[1.5px] border-line"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </div>
  );
}

function Portrait({ appearance, size }: { appearance?: Appearance; size: number }) {
  if (appearance?.sprite) return <SpriteFrame appearance={appearance} size={size} />;
  if (appearance?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={appearance.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <span
      className="absolute inset-0 flex items-center justify-center leading-none drop-shadow-[0_2px_0_rgba(27,20,56,0.55)]"
      style={{ fontSize: Math.round(size * 0.46) }}
    >
      {appearance?.icon ?? "?"}
    </span>
  );
}

/** 스프라이트 시트의 대기(idle) 첫 프레임을 칸에 맞춰 잘라 보여줌 */
function SpriteFrame({ appearance, size }: { appearance: Appearance; size: number }) {
  const sheet = appearance.sprite!;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const row = sheet.animations.idle.row;
  // 프레임 높이를 칸 높이의 1.25배로 확대해 인물이 칸을 채우게
  const scale = (size * 1.25) / sheet.frameHeight;
  const frameW = sheet.frameWidth * scale;
  const frameH = sheet.frameHeight * scale;
  const flip = sheet.facing === "left";
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sheet.src}
        alt=""
        draggable={false}
        onLoad={(e) =>
          setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        }
        className="absolute max-w-none"
        style={{
          width: natural ? natural.w * scale : undefined,
          height: natural ? natural.h * scale : undefined,
          left: (size - frameW) / 2,
          top: (size - frameH) / 2 - row * frameH + size * 0.08,
          transform: flip ? "scaleX(-1)" : undefined,
          visibility: natural ? "visible" : "hidden",
        }}
      />
    </div>
  );
}
