"use client";

import Icon from "@/components/ui/Icon";
import { BENCH_SIZE, GRADE_COLOR, GRADE_LABEL, GRADE_ORDER } from "@/game/constants";
import type { GameEngine } from "@/game/engine";
import { gachaCost } from "@/game/gacha";
import type { GachaDef } from "@/game/types";

function RateBar({ gacha }: { gacha: GachaDef }) {
  const entries = GRADE_ORDER.map((g) => [g, Math.max(0, gacha.rates[g] ?? 0)] as const).filter(
    ([, v]) => v > 0
  );
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div>
      <div className="gauge flex h-3.5">
        {entries.map(([g, v]) => (
          <div
            key={g}
            className="h-full border-r-2 border-line last:border-r-0"
            style={{ width: `${(v / total) * 100}%`, backgroundColor: GRADE_COLOR[g] }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px]">
        {entries.map(([g, v]) => (
          <span key={g} className="flex items-center gap-1 text-parchment-100">
            <span className="h-2 w-2 rotate-45 rounded-[2px] border-[1.5px] border-line" style={{ backgroundColor: GRADE_COLOR[g] }} />
            {GRADE_LABEL[g]} {Math.round((v / total) * 1000) / 10}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** 상점: 뽑기 종류별 제단 카드 */
export default function ShopPanel({
  engine,
  regions,
  regionSel,
  onRegionSel,
  onRoll,
}: {
  engine: GameEngine;
  regions: { name: string; color: string }[];
  regionSel: string;
  onRegionSel: (r: string) => void;
  onRoll: (gachaId: string, region?: string) => void;
}) {
  const benchFull = engine.bench.length >= BENCH_SIZE;
  return (
    <div className="space-y-2.5">
      {engine.gachaDefs.map((g) => {
        const cost = gachaCost(g, engine.job);
        const discounted = cost < g.cost;
        const needsRegion = g.regionMode === "select";
        const canRoll = engine.canAffordGacha(g.id) && !benchFull && (!needsRegion || !!regionSel);
        return (
          <div key={g.id} className="well p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon name="gem" className="icon-toon shrink-0 text-lg text-gold-300" />
                  <span className="truncate font-display text-lg text-parchment-50 text-toon-sm">{g.name}</span>
                  {g.regionMode === "fixed" && g.fixedRegion && <span className="chip">{g.fixedRegion}</span>}
                </div>
                {g.description && <p className="mt-0.5 text-xs text-parchment-300">{g.description}</p>}
              </div>
              <button
                className="btn-gold h-10 shrink-0 rounded-xl px-3 text-lg"
                disabled={!canRoll}
                onClick={() => onRoll(g.id, needsRegion ? regionSel : undefined)}
              >
                <Icon name="coin" className="text-base text-gold-200" />
                {cost}
                {discounted && <span className="text-[10px] line-through opacity-60">{g.cost}</span>}
              </button>
            </div>
            <div className="mt-2.5">
              <RateBar gacha={g} />
            </div>
            {needsRegion && (
              <div className="mt-2.5 grid grid-cols-4 gap-1 sm:grid-cols-5">
                {regions.map((r) => {
                  const active = regionSel === r.name;
                  return (
                    <button
                      key={r.name}
                      onClick={() => onRegionSel(active ? "" : r.name)}
                      className={`truncate rounded-lg border-2 border-line px-1 py-1 text-xs transition duration-150 ease-spring ${
                        active ? "-translate-y-0.5 text-parchment-50 text-toon-sm" : "bg-ink-950/60 hover:bg-ink-950/90"
                      }`}
                      style={
                        active
                          ? { backgroundColor: r.color, boxShadow: "0 3px 0 #1b1438" }
                          : { color: r.color }
                      }
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-center gap-3 pt-1 text-sm text-parchment-300">
        <span className="plate h-8 gap-1 px-2.5">
          <Icon name="coin" className="text-gold-400" />
          <span className="font-display text-gold-300 text-toon-sm">{engine.gold}</span>
        </span>
        <span className={benchFull ? "text-blood-400 text-toon-sm" : ""}>
          대기석 {engine.bench.length}/{BENCH_SIZE}
          {benchFull && " — 가득 참"}
        </span>
      </div>
    </div>
  );
}
