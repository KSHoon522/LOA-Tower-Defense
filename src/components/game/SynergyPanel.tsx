"use client";

import Icon from "@/components/ui/Icon";
import { Tip } from "@/components/ui/Overlay";
import type { ActiveSynergy } from "@/game/types";
import { effectText } from "./labels";

const HEX = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

/** 지역 색 육각 문장 + 인원 수 */
export function SynergyEmblem({ syn, size = 34 }: { syn: ActiveSynergy; size?: number }) {
  const active = syn.activeTierIndex >= 0;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center transition duration-300"
      style={{
        width: size,
        height: size * 1.1,
        clipPath: HEX,
        background: active
          ? `linear-gradient(160deg, ${syn.color} 0%, ${syn.color}99 45%, #0e131e 100%)`
          : "linear-gradient(160deg, #2a3248 0%, #141a26 100%)",
      }}
    >
      <div
        className="absolute inset-[2px] flex items-center justify-center"
        style={{ clipPath: HEX, background: active ? `${syn.color}26` : "#0e131e" }}
      >
        <span
          className="font-display text-sm font-black"
          style={{ color: active ? "#fbf7ee" : "#7f7867", textShadow: active ? `0 0 8px ${syn.color}` : undefined }}
        >
          {syn.count}
        </span>
      </div>
    </div>
  );
}

function TierPips({ syn }: { syn: ActiveSynergy }) {
  return (
    <div className="flex items-center gap-0.5 font-display text-[11px] font-bold">
      {syn.tiers.map((t, i) => {
        const reached = syn.count >= t.count;
        const current = i === syn.activeTierIndex;
        return (
          <span key={t.count} className="flex items-center">
            {i > 0 && <span className="mx-0.5 text-parchment-500/50">›</span>}
            <span
              className={current ? "scale-110" : ""}
              style={{ color: reached ? syn.color : "#5c5a52", textShadow: current ? `0 0 6px ${syn.color}` : undefined }}
            >
              {t.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function SynergyTip({ syn }: { syn: ActiveSynergy }) {
  return (
    <>
      <div className="font-serif text-sm font-bold" style={{ color: syn.color }}>
        {syn.region} · {syn.name}
      </div>
      {syn.description && <p className="mt-1 text-parchment-400">{syn.description}</p>}
      <div className="mt-2 space-y-1">
        {syn.tiers.map((tier, i) => (
          <div
            key={tier.count}
            className={`rounded-md px-2 py-1 ${
              i === syn.activeTierIndex ? "bg-gold-500/15 text-gold-200" : "bg-ink-950/60 text-parchment-500"
            }`}
          >
            <b className="mr-1">{tier.count}명</b>
            {tier.effects.map(effectText).join(" · ")}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-parchment-500">효과는 아군 전체에 적용됩니다</p>
    </>
  );
}

/** 데스크톱 좌측 시너지 목록 */
export function SynergyRows({ synergies }: { synergies: ActiveSynergy[] }) {
  if (synergies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-parchment-500">
        <Icon name="hex" className="text-2xl text-parchment-500/40" />
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
              className={`flex animate-fade-in items-center gap-2.5 rounded-lg px-1.5 py-1 transition duration-200 hover:bg-white/[0.04] ${
                active ? "" : "opacity-60"
              }`}
            >
              <SynergyEmblem syn={syn} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-parchment-100">{syn.region}</div>
                <div className="truncate text-[10px] text-parchment-500">
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
            className={`flex animate-fade-in items-center gap-1.5 rounded-full border bg-ink-950/80 py-0.5 pl-1 pr-2 text-[10px] font-bold backdrop-blur ${
              active ? "border-white/15" : "border-white/5 opacity-70"
            }`}
          >
            <span
              className="h-3.5 w-3"
              style={{ clipPath: HEX, background: active ? syn.color : "#3a4763" }}
            />
            <span className="text-parchment-100">{syn.region}</span>
            <span style={{ color: active ? syn.color : "#7f7867" }}>{syn.count}</span>
          </button>
        );
      })}
    </>
  );
}

/** 시너지 전체 설명 (모바일 시트) */
export function SynergyDetailList({ synergies }: { synergies: ActiveSynergy[] }) {
  if (synergies.length === 0) {
    return <p className="py-6 text-center text-sm text-parchment-500">배치된 캐릭터가 없습니다.</p>;
  }
  return (
    <div className="space-y-2">
      {synergies.map((syn) => (
        <div key={syn.synergyId} className="flex gap-3 rounded-xl border border-white/5 bg-ink-950/50 p-2.5">
          <SynergyEmblem syn={syn} size={38} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-sm font-bold" style={{ color: syn.color }}>
                {syn.region} · {syn.name}
              </span>
              <TierPips syn={syn} />
            </div>
            <div className="mt-1.5 space-y-1">
              {syn.tiers.map((tier, i) => (
                <div
                  key={tier.count}
                  className={`rounded-md px-2 py-1 ${
                    i === syn.activeTierIndex ? "bg-gold-500/15 text-gold-200" : "bg-ink-900/80 text-parchment-500"
                  }`}
                >
                  <b className="mr-1">{tier.count}명</b>
                  {tier.effects.map(effectText).join(" · ")}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-[10px] text-parchment-500">효과는 아군 전체에 적용됩니다</p>
    </div>
  );
}
