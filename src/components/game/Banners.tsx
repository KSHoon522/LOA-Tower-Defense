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

/** 리본 색 [앞면, 접힌 꼬리] + 머리 아이콘 */
const TONE: Record<BannerKind, { face: string; tail: string; icon: IconName }> = {
  wave: { face: "#ffb81c", tail: "#d98a00", icon: "swords" },
  clear: { face: "#4cc23a", tail: "#2f8f27", icon: "check" },
  boss: { face: "#f43f4e", tail: "#b81d36", icon: "skull" },
  bossdown: { face: "#ffb81c", tail: "#d98a00", icon: "crown" },
  legend: { face: "#ff8a1f", tail: "#c25e00", icon: "star" },
  jackpot: { face: "#ff8a1f", tail: "#c25e00", icon: "sparkles" },
};

/** 굵은 외곽선 리본 (가운데가 살짝 휜 띠 + 양끝 갈라진 꼬리) */
function Ribbon({ face, tail }: { face: string; tail: string }) {
  return (
    <svg viewBox="0 0 600 130" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
      <g stroke="#1b1438" strokeWidth="6" strokeLinejoin="round">
        <path d="M70 46 L4 46 L30 82 L4 118 L84 118 Z" fill={tail} />
        <path d="M530 46 L596 46 L570 82 L596 118 L516 118 Z" fill={tail} />
        <path d="M44 30 Q300 6 556 30 L556 104 Q300 80 44 104 Z" fill={face} />
      </g>
      <path d="M56 40 Q300 18 544 40 L544 50 Q300 28 56 50 Z" fill="#ffffff" fillOpacity="0.3" />
    </svg>
  );
}

/** 화면 중앙 배너 (웨이브 시작, 보스 출현, 전설 획득 …) */
export function BannerLayer({ banner }: { banner: BannerData | null }) {
  if (!banner) return null;
  const tone = TONE[banner.kind];
  const shiny = banner.kind === "legend" || banner.kind === "jackpot";
  return (
    <div key={banner.id} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      {shiny && (
        <div
          className="absolute left-1/2 top-1/2 h-[620px] w-[620px] animate-rays opacity-50"
          style={{
            background: "repeating-conic-gradient(from 0deg, #fff4b8 0deg 9deg, transparent 9deg 22deg)",
            maskImage: "radial-gradient(closest-side, black 30%, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, black 30%, transparent)",
          }}
        />
      )}
      <div className="relative flex animate-banner flex-col items-center px-3 text-center">
        {banner.unit && (
          <div className="mb-1 animate-summon">
            <GradeSlot grade={banner.unit.grade} appearance={banner.unit.appearance} size={84} selected />
          </div>
        )}
        {/* 머리표: 아이콘 + 작은 글씨 */}
        <div className="relative z-10 -mb-3 flex items-center gap-1.5 rounded-full border-[3px] border-line bg-ink-900 px-3 py-0.5 font-display text-sm uppercase text-parchment-50 text-toon-sm shadow-[0_3px_0_#1b1438]">
          <Icon name={tone.icon} style={{ color: tone.face }} />
          {banner.kicker}
        </div>
        <div className="relative w-[min(94vw,600px)] origin-center animate-ribbon" style={{ aspectRatio: "600 / 130" }}>
          <Ribbon face={tone.face} tail={tone.tail} />
          <div className="absolute inset-x-[12%] top-[16%] flex h-[60%] items-center justify-center">
            <span className="truncate font-display text-[clamp(1.7rem,7.5vw,3.2rem)] leading-none text-parchment-50 text-toon">
              {banner.title}
            </span>
          </div>
        </div>
        {banner.sub && (
          <div className="-mt-1 rounded-xl bg-line/60 px-3 py-1 text-sm text-parchment-50 sm:text-base">{banner.sub}</div>
        )}
      </div>
    </div>
  );
}

/** 상단 알림 (소환 결과, 미션, 판매 …) — 튀어나온 뒤 2.4초 뒤 사라짐 */
export function ToastStack({ toasts }: { toasts: ToastData[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex max-w-[92%] items-center gap-1.5 rounded-full border-[3px] border-line bg-ink-900 py-0.5 pl-0.5 pr-3 text-sm text-parchment-50 shadow-[0_3px_0_#1b1438]"
          style={{
            animation:
              "toast-in 360ms ease-out backwards, fade-out 320ms cubic-bezier(0.7,0,0.84,0) 2.2s forwards",
          }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-parchment-50"
            style={{ backgroundColor: t.color ?? "#ffbf1f" }}
          >
            <Icon name={t.icon ?? "info"} className="text-xs drop-shadow-[0_1px_0_#1b1438]" />
          </span>
          <span className="truncate text-toon-sm">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
