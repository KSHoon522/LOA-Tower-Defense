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
      className={`group relative flex flex-col items-center justify-center overflow-hidden border-[3px] border-line text-parchment-50 transition duration-150 ease-spring active:translate-y-[3px] disabled:cursor-not-allowed ${
        round ? "h-14 w-14 rounded-full" : "h-[70px] w-[70px] rounded-2xl"
      } ${ready && !aiming ? "hover:-translate-y-0.5" : ""}`}
      style={{
        background: `linear-gradient(180deg, ${color} 0%, ${color} 50%, color-mix(in srgb, ${color} 70%, #1b1438) 50%)`,
        boxShadow: [
          "inset 0 3px 0 rgba(255,255,255,0.4)",
          "inset 0 -4px 0 rgba(0,0,0,0.18)",
          "0 4px 0 #1b1438",
          // 테두리는 아래 두께까지 감싸야 버튼 밑에서 끊기지 않음 (불투명 색이라야 두 겹이 겹쳐도 얼룩이 안 짐)
          aiming
            ? "0 4px 0 4px #ff9d4d, 0 0 0 4px #ff9d4d"
            : ready
              ? "0 4px 0 3px #ffe266, 0 0 0 3px #ffe266"
              : "",
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      <JobEmblem appearance={appearance} size={round ? 28 : 30} />
      {!round && (
        <span className="mt-0.5 w-full truncate px-1 text-center text-[11px] text-parchment-50 text-toon-sm">
          {skill.name}
        </span>
      )}
      {skill.effect.type === "damage_area" && ready && !aiming && (
        <Icon name="target" className="absolute bottom-1 left-1 text-xs text-[#ffe0c2] drop-shadow-[0_1px_0_#1b1438]" />
      )}

      {/* 쿨다운 그림자 */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: "conic-gradient(rgba(16,22,74,0.8) calc(var(--cd, 0) * 1turn), transparent 0)" }}
      />
      {cooling && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-parchment-50 text-toon">
          {Math.ceil(cdLeft)}
        </span>
      )}
      {exhausted && (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-950/75 font-display text-xs text-blood-400 text-toon-sm">
          소진
        </span>
      )}
      {aiming && (
        <span className="absolute inset-x-0 bottom-0 border-t-2 border-line bg-[#ff9d4d] py-px text-center text-[10px] text-parchment-50 text-toon-sm">
          조준 중
        </span>
      )}
      {/* 남은 사용 횟수 */}
      <span
        className={`absolute right-0.5 top-0.5 min-w-[18px] rounded-full border-2 border-line px-1 text-center font-display text-[10px] leading-[14px] ${
          exhausted ? "bg-blood-500 text-parchment-50" : "bg-gold-400 text-line"
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
          <div className="font-display text-base text-gold-300 text-toon-sm">{skill.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-parchment-300">
            <span className="flex items-center gap-0.5">
              <Icon name="hourglass" /> {skill.cooldown}초
            </span>
            <span>남은 사용 {usesLeft}회</span>
          </div>
          {skill.description && <p className="mt-1 text-parchment-100">{skill.description}</p>}
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
