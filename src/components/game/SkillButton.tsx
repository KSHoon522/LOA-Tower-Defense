"use client";

import Icon from "@/components/ui/Icon";
import JobEmblem from "@/components/ui/JobEmblem";
import { Tip } from "@/components/ui/Overlay";
import type { Appearance, JobActiveSkill } from "@/game/types";

/**
 * 직업 액티브 스킬 버튼
 * - 쿨다운은 원형으로 걷히는 그림자 (CSS 변수 --cd 0~1, 게임 루프가 매 프레임 갱신)
 * - data-skill-index로 루프가 이 버튼을 찾음
 */
export default function SkillButton({
  skill,
  index,
  cdLeft,
  usesLeft,
  aiming,
  appearance,
  color = "#cfa24e",
  variant,
  onClick,
}: {
  skill: JobActiveSkill;
  index: number;
  cdLeft: number;
  usesLeft: number;
  aiming: boolean;
  /** 직업 외형 (엠블럼 표시) */
  appearance?: Appearance;
  color?: string;
  variant: "square" | "round";
  onClick: () => void;
}) {
  const exhausted = usesLeft <= 0;
  const cooling = cdLeft > 0 && !exhausted;
  const ready = !cooling && !exhausted;
  const round = variant === "round";

  const button = (
    <button
      data-skill-index={index}
      disabled={cooling || exhausted}
      onClick={onClick}
      aria-label={`${skill.name} (남은 사용 ${usesLeft}회)`}
      className={`group relative flex flex-col items-center justify-center overflow-hidden border text-parchment-50 transition duration-200 ease-out-expo active:scale-95 disabled:cursor-not-allowed ${
        round ? "h-14 w-14 rounded-full" : "h-[68px] w-[68px] rounded-xl"
      } ${
        aiming
          ? "border-[#ff9d4d] shadow-[0_0_0_2px_rgba(255,157,77,0.35),0_0_22px_rgba(255,157,77,0.55)]"
          : ready
            ? "border-gold-400/70 hover:-translate-y-0.5 hover:border-gold-300"
            : "border-white/10"
      }`}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${color}55 0%, #131a28 55%, #0a0e16 100%)`,
        boxShadow: ready && !aiming ? `0 8px 22px -10px ${color}` : undefined,
      }}
    >
      <JobEmblem appearance={appearance} size={round ? 26 : 30} />
      {!round && (
        <span className="mt-1 w-full truncate px-1 text-center text-[10px] font-bold text-parchment-100">
          {skill.name}
        </span>
      )}
      {skill.effect.type === "damage_area" && ready && !aiming && (
        <Icon name="target" className="absolute bottom-1 left-1 text-[11px] text-[#ffb27a]" />
      )}

      {/* 쿨다운 그림자 */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: "conic-gradient(rgba(5,7,11,0.78) calc(var(--cd, 0) * 1turn), transparent 0)" }}
      />
      {cooling && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-parchment-50 drop-shadow">
          {Math.ceil(cdLeft)}
        </span>
      )}
      {exhausted && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-950/70 text-[10px] font-bold text-blood-400">
          소진
        </span>
      )}
      {aiming && (
        <span className="absolute inset-x-0 bottom-0 bg-[#ff9d4d] py-px text-center text-[9px] font-black text-ink-950">
          조준 중
        </span>
      )}
      {/* 남은 사용 횟수 */}
      <span
        className={`absolute right-1 top-1 min-w-[16px] rounded-full px-1 text-center text-[9px] font-black leading-[14px] ${
          exhausted ? "bg-blood-600 text-parchment-50" : "bg-gold-400 text-ink-950"
        }`}
      >
        {usesLeft}
      </span>
    </button>
  );

  if (round) return button;
  return (
    <Tip
      side="top"
      tip={
        <>
          <div className="font-serif text-sm font-bold text-gold-300">{skill.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-parchment-500">
            <span className="flex items-center gap-0.5">
              <Icon name="hourglass" /> {skill.cooldown}초
            </span>
            <span>남은 사용 {usesLeft}회</span>
          </div>
          {skill.description && <p className="mt-1 text-parchment-300">{skill.description}</p>}
          {skill.effect.type === "damage_area" && (
            <p className="mt-1 text-[#ffb27a]">버튼을 누른 뒤 맵을 클릭해 시전합니다</p>
          )}
        </>
      }
    >
      {button}
    </Tip>
  );
}
