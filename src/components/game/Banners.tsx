"use client";

import GradeSlot from "@/components/ui/GradeSlot";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { TowerDef } from "@/game/types";

export type BannerKind = "wave" | "boss" | "clear" | "bossdown" | "legend" | "jackpot";

export interface BannerData {
  id: number;
  kind: BannerKind;
  kicker: string;
  title: string;
  sub?: string;
  /** 전설 획득 등: 초상 표시 */
  unit?: TowerDef;
}

export interface ToastData {
  id: number;
  text: string;
  icon?: IconName;
  color?: string;
}

const TONE: Record<BannerKind, { line: string; title: string; glow: string }> = {
  wave: { line: "#f3dc9c", title: "text-gold-grad", glow: "rgba(230,194,116,0.45)" },
  clear: { line: "#a7f3d0", title: "text-gold-grad", glow: "rgba(126,224,166,0.4)" },
  boss: { line: "#ff6b6b", title: "text-blood-grad", glow: "rgba(229,72,77,0.55)" },
  bossdown: { line: "#f3dc9c", title: "text-gold-grad", glow: "rgba(230,194,116,0.5)" },
  legend: { line: "#ffb347", title: "text-legend-grad", glow: "rgba(249,146,0,0.6)" },
  jackpot: { line: "#ffb347", title: "text-legend-grad", glow: "rgba(249,146,0,0.6)" },
};

/** 화면 중앙 배너 (웨이브 시작, 보스 출현, 전설 획득 …) */
export function BannerLayer({ banner }: { banner: BannerData | null }) {
  if (!banner) return null;
  const tone = TONE[banner.kind];
  const big = banner.kind !== "clear";
  return (
    <div key={banner.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      {/* 가독성을 위한 어두운 띠 */}
      <div className="absolute inset-x-0 h-40 animate-banner bg-[linear-gradient(90deg,transparent,rgba(5,7,11,0.82)_25%,rgba(5,7,11,0.82)_75%,transparent)]" />
      {(banner.kind === "legend" || banner.kind === "jackpot") && (
        <div
          className="absolute left-1/2 top-1/2 h-[560px] w-[560px] animate-rays opacity-40"
          style={{
            background: `repeating-conic-gradient(from 0deg, ${tone.line}55 0deg 6deg, transparent 6deg 18deg)`,
            maskImage: "radial-gradient(closest-side, black, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, black, transparent)",
          }}
        />
      )}
      <div className="relative flex flex-col items-center px-4 text-center">
        {banner.unit && (
          <div className="mb-2 animate-summon">
            <GradeSlot grade={banner.unit.grade} appearance={banner.unit.appearance} size={72} selected />
          </div>
        )}
        <div className="flex w-[min(86vw,560px)] items-center gap-4">
          <span
            className="h-px flex-1 origin-right animate-line-grow"
            style={{ background: `linear-gradient(270deg, ${tone.line}, transparent)` }}
          />
          <span
            className="animate-banner whitespace-nowrap font-display text-[11px] font-bold uppercase"
            style={{ color: tone.line }}
          >
            {banner.kicker}
          </span>
          <span
            className="h-px flex-1 origin-left animate-line-grow"
            style={{ background: `linear-gradient(90deg, ${tone.line}, transparent)` }}
          />
        </div>
        <div
          className={`animate-banner font-display font-black leading-tight ${tone.title} ${
            big ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"
          }`}
          style={{ filter: `drop-shadow(0 0 18px ${tone.glow})` }}
        >
          {banner.title}
        </div>
        {banner.sub && (
          <div className="mt-1 animate-banner font-serif text-sm font-bold text-parchment-100 sm:text-base">
            {banner.sub}
          </div>
        )}
      </div>
    </div>
  );
}

/** 상단 알림 (소환 결과, 미션, 판매 …) — 등장 후 2.4초 뒤 사라짐 */
export function ToastStack({ toasts }: { toasts: ToastData[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex max-w-[92%] items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/90 px-3 py-1 text-xs font-semibold text-parchment-100 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.9)] backdrop-blur"
          style={{
            animation:
              "toast-in 260ms cubic-bezier(0.16,1,0.3,1) backwards, fade-out 320ms cubic-bezier(0.7,0,0.84,0) 2.2s forwards",
            borderColor: t.color ? `${t.color}55` : undefined,
          }}
        >
          {t.icon && <Icon name={t.icon} className="shrink-0" style={{ color: t.color ?? "#e6c274" }} />}
          <span className="truncate" style={{ color: t.color }}>
            {t.text}
          </span>
        </div>
      ))}
    </div>
  );
}
