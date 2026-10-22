"use client";

import { useState } from "react";
import { GRADE_BG, GRADE_COLOR } from "@/game/constants";
import type { Appearance, Grade } from "@/game/types";

/** 적/특수 슬롯용 팔레트 */
export const FOE_PALETTE = { color: "#e5484d", bg: ["#2a0d10", "#5c1a1f"] as [string, string] };
export const BOSS_PALETTE = { color: "#ff6b6b", bg: ["#3a0a0e", "#8f1d24"] as [string, string] };

/**
 * 로스트아크 아이템 슬롯처럼 등급 그라데이션 배경 + 등급색 테두리를 가진 초상 칸
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
  const color = palette?.color ?? (grade ? GRADE_COLOR[grade] : "#7f7867");
  const [bg0, bg1] = palette?.bg ?? (grade ? GRADE_BG[grade] : ["#141a26", "#252e42"]);
  const radius = Math.max(6, Math.round(size * 0.16));

  return (
    <div
      className={`relative shrink-0 overflow-hidden transition duration-200 ease-out-expo ${
        dim ? "opacity-45 saturate-50" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${bg0} 0%, ${bg1} 100%)`,
        boxShadow: [
          `inset 0 0 0 1px ${color}${selected ? "ff" : "8c"}`,
          "inset 0 -12px 18px -6px rgba(0,0,0,0.45)",
          selected ? `0 0 0 2px #05070b, 0 0 0 3.5px ${color}, 0 0 18px ${color}88` : "0 4px 10px -6px rgba(0,0,0,0.8)",
        ].join(", "),
      }}
    >
      {/* 윗부분 광택 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.12] to-transparent" />
      {dashed && (
        <div
          className="pointer-events-none absolute inset-[3px] animate-pulse border-2 border-dashed border-gold-300/90"
          style={{ borderRadius: radius - 2 }}
        />
      )}
      <Portrait appearance={appearance} size={size} />
      {/* 등급 보석 */}
      {grade && (
        <div
          className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 rotate-45 shadow-[0_0_6px_currentColor]"
          style={{ backgroundColor: color, color }}
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
      className="absolute inset-0 flex items-center justify-center leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
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
