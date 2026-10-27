"use client";

import Icon from "@/components/ui/Icon";
import { Tip } from "@/components/ui/Overlay";
import type { ActiveSynergy } from "@/game/types";
import { effectText } from "./labels";

const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/** 지역 색 육각 문장 + 인원 수 (바깥 육각을 외곽선 색으로 깔아 굵은 테두리처럼) */
export function SynergyEmblem({ syn, size = 34 }: { syn: ActiveSynergy; size?: number }) {
  const active = syn.activeTierIndex >= 0;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center transition duration-300"
      style={{ width: size, height: size * 1.1, clipPath: HEX, background: "#1b1438" }}
    >
      <div
        className="absolute inset-[3px] flex items-center justify-center"
        style={{
          clipPath: HEX,
          background: active
            ? `linear-gradient(180deg, ${syn.color} 0%, ${syn.color} 50%, color-mix(in srgb, ${syn.color} 70%, #1b1438) 50%)`
            : "linear-gradient(180deg, #4a5690 0%, #4a5690 50%, #3b467c 50%)",
        }}
      >
        <span className={`font-display text-base text-toon-sm ${active ? "text-parchment-50" : "text-parchment-400"}`}>
          {syn.count}
        </span>
      </div>
    </div>
  );
}

function TierPips({ syn }: { syn: ActiveSynergy }) {
  return (
    <div className="flex items-center gap-0.5 font-display text-[11px]">
      {syn.tiers.map((t, i) => {
        const reached = syn.count >= t.count;
        const current = i === syn.activeTierIndex;
        return (
          <span
            key={t.count}
            className={`min-w-[18px] rounded-md border-2 border-line px-0.5 text-center leading-[14px] transition duration-200 ease-spring ${
              reached ? "text-parchment-50 text-toon-sm" : "bg-ink-950/60 text-parchment-500"
            } ${current ? "-translate-y-0.5 scale-110" : ""}`}
            style={reached ? { backgroundColor: syn.color } : undefined}
          >
            {t.count}
          </span>
        );
      })}
    </div>
  );
}

function SynergyTip({ syn }: { syn: ActiveSynergy }) {
  return (
    <>
      <div className="font-display text-base text-toon-sm" style={{ color: syn.color }}>
        {syn.region} · {syn.name}
      </div>
      {syn.description && <p className="mt-1 text-parchment-100">{syn.description}</p>}
      <div className="mt-2 space-y-1">
        {syn.tiers.map((tier, i) => (
          <div
            key={tier.count}
            className={`rounded-lg px-2 py-1 ${
              i === syn.activeTierIndex ? "border-2 border-line bg-gold-400 text-line" : "well text-parchment-300"
            }`}
          >
            <span className="mr-1 font-display">{tier.count}명</span>
            {tier.effects.map(effectText).join(" · ")}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-parchment-300">효과는 아군 전체에 적용됩니다</p>
    </>
  );
}

/** 데스크톱 좌측 시너지 목록 */
export function SynergyRows({ synergies }: { synergies: ActiveSynergy[] }) {
  if (synergies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-sm text-parchment-300">
        <Icon name="hex" className="animate-float text-3xl text-parchment-400" />
        캐릭터를 배치하면
        <br />
        지역 시너지가 활성화됩니다
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {synergies.map((syn) => {
        const active = syn.activeTierIndex >= 0;
        return (
          <Tip key={syn.synergyId} tip={<SynergyTip syn={syn} />}>
            <div
              className={`flex animate-pop-in items-center gap-2.5 rounded-xl px-1.5 py-1 transition duration-200 hover:bg-white/10 ${
                active ? "" : "opacity-70"
              }`}
            >
              <SynergyEmblem syn={syn} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] text-parchment-50 text-toon-sm">{syn.region}</div>
                <div className="truncate text-[11px] text-parchment-300">
                  {active
                    ? syn.tiers[syn.activeTierIndex].effects.map(effectText).join(" · ")
                    : syn.name}
                </div>
              </div>
              <TierPips syn={syn} />
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

/** 모바일: 맵 위 시너지 칩 */
export function SynergyChips({ synergies, onOpen }: { synergies: ActiveSynergy[]; onOpen: () => void }) {
  return (
    <>
      {synergies.map((syn) => {
        const active = syn.activeTierIndex >= 0;
        return (
          <button
            key={syn.synergyId}
            onClick={onOpen}
            className={`flex animate-pop-in items-center gap-1 rounded-full border-2 border-line bg-ink-900 py-0.5 pl-0.5 pr-2 text-[11px] text-parchment-50 shadow-[0_2px_0_#1b1438] ${
              active ? "" : "opacity-75"
            }`}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-line font-display text-[9px] text-toon-sm"
              style={{ background: active ? syn.color : "#4a5690" }}
            >
              {syn.count}
            </span>
            <span>{syn.region}</span>
          </button>
        );
      })}
    </>
  );
}

/** 시너지 전체 설명 (모바일 시트) */
export function SynergyDetailList({ synergies }: { synergies: ActiveSynergy[] }) {
  if (synergies.length === 0) {
    return <p className="py-6 text-center text-sm text-parchment-300">배치된 캐릭터가 없습니다.</p>;
  }
  return (
    <div className="space-y-2">
      {synergies.map((syn) => (
        <div key={syn.synergyId} className="well flex gap-3 p-2.5">
          <SynergyEmblem syn={syn} size={38} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-base text-toon-sm" style={{ color: syn.color }}>
                {syn.region} · {syn.name}
              </span>
              <TierPips syn={syn} />
            </div>
            <div className="mt-1.5 space-y-1">
              {syn.tiers.map((tier, i) => (
                <div
                  key={tier.count}
                  className={`rounded-lg px-2 py-1 ${
                    i === syn.activeTierIndex ? "border-2 border-line bg-gold-400 text-line" : "bg-ink-900/80 text-parchment-300"
                  }`}
                >
                  <span className="mr-1 font-display">{tier.count}명</span>
                  {tier.effects.map(effectText).join(" · ")}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-[11px] text-parchment-300">효과는 아군 전체에 적용됩니다</p>
    </div>
  );
}
