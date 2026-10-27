"use client";

import GradeSlot, { BOSS_PALETTE } from "@/components/ui/GradeSlot";
import Icon from "@/components/ui/Icon";
import { describeMissionCondition } from "@/game/constants";
import type { GameEngine } from "@/game/engine";
import type { EnemyDef, MissionDef } from "@/game/types";
import { TRAIT_ICON, traitText } from "./labels";

export interface MissionInfo {
  def: MissionDef;
  upcoming: boolean;
  failed: boolean;
  progress: string;
}

type BossInfo = NonNullable<ReturnType<GameEngine["bossPreview"]>>;

function Kicker({ children, tone = "text-gold-300" }: { children: React.ReactNode; tone?: string }) {
  return (
    <div className={`flex items-center gap-1.5 font-display text-sm uppercase text-toon-sm ${tone}`}>
      {children}
    </div>
  );
}

/** 다가오는(또는 싸우는 중인) 보스 */
export function BossCard({ boss }: { boss: BossInfo }) {
  const alive = boss.alive;
  return (
    <div
      className="relative overflow-hidden rounded-[20px] border-[3px] border-line p-2.5"
      style={{
        background: "linear-gradient(180deg, #e2475a 0%, #b81d36 100%)",
        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -4px 0 rgba(0,0,0,0.2), 0 5px 0 #1b1438",
      }}
    >
      <Kicker tone="text-gold-300">
        <Icon name="crown" />
        {alive ? "Boss Battle" : `Boss · Wave ${boss.wave}`}
      </Kicker>
      <div className="mt-2 flex gap-2.5">
        <GradeSlot palette={BOSS_PALETTE} appearance={boss.def.appearance} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-tight text-parchment-50 text-toon">{boss.def.name}</div>
          {alive ? (
            <>
              <div className="gauge mt-1 h-3.5">
                <div
                  data-boss-hp
                  className="gauge-fill bg-leaf-400"
                  style={{ width: `${Math.max(0, (alive.hp / boss.maxHp) * 100)}%` }}
                />
              </div>
              <div className="mt-0.5 font-display text-[11px] text-parchment-50 text-toon-sm">
                {Math.max(0, Math.round(alive.hp)).toLocaleString()} / {boss.maxHp.toLocaleString()}
              </div>
            </>
          ) : (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-parchment-50">
              <Icon name="heart" className="text-parchment-50" />
              예상 체력 {boss.maxHp.toLocaleString()}
            </div>
          )}
          <div className="mt-1 flex gap-2.5 font-display text-[11px] text-parchment-50/90">
            <span className="flex items-center gap-0.5">
              <Icon name="shield" /> {boss.def.defense}
            </span>
            <span className="flex items-center gap-0.5">
              <Icon name="orb" /> {boss.def.magicDefense}
            </span>
            <span className="flex items-center gap-0.5">
              <Icon name="speed" /> {boss.def.moveSpeed}
            </span>
          </div>
        </div>
      </div>
      {boss.def.traits && boss.def.traits.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {boss.def.traits.map((tr, i) => (
            <span key={i} className="chip bg-blood-600">
              <Icon name={TRAIT_ICON[tr.type] ?? "info"} />
              {traitText(tr)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 다음 웨이브 구성 */
export function NextWave({ wave, preview }: { wave: number; preview: { def: EnemyDef; count: number }[] }) {
  if (preview.length === 0) return null;
  return (
    <div className="frame p-2.5">
      <Kicker>
        <Icon name="flag" />
        Next · Wave {wave}
      </Kicker>
      <div className="mt-2 space-y-1">
        {preview.map(({ def, count }) => (
          <div key={def.id} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-line text-base shadow-[0_2px_0_#1b1438] ${
                def.isBoss ? "bg-blood-500" : "bg-ink-700"
              }`}
            >
              {def.appearance.icon}
            </span>
            <span className={`min-w-0 flex-1 truncate text-[13px] ${def.isBoss ? "text-blood-400 text-toon-sm" : "text-parchment-50"}`}>
              {def.name}
            </span>
            {def.traits?.map((t, i) => (
              <Icon key={i} name={TRAIT_ICON[t.type] ?? "info"} className="shrink-0 text-[#d9c4ff]" title={traitText(t)} />
            ))}
            <span className="shrink-0 font-display text-base text-parchment-50 text-toon-sm">×{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 웨이브 미션 */
export function MissionCard({ info, wave }: { info: MissionInfo; wave: number }) {
  return (
    <div
      className={`rounded-[20px] border-[3px] border-line p-2.5 transition duration-300 ${info.failed ? "saturate-50" : ""}`}
      style={{
        background: info.failed
          ? "linear-gradient(180deg, #8a5a6a 0%, #6b4152 100%)"
          : "linear-gradient(180deg, #8f62ec 0%, #6a3fcf 100%)",
        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.22), inset 0 -4px 0 rgba(0,0,0,0.18), 0 5px 0 #1b1438",
      }}
    >
      <div className="flex items-center justify-between">
        <Kicker tone={info.failed ? "text-blood-400" : "text-gold-300"}>
          <Icon name="target" />
          {info.upcoming ? `Mission · Wave ${wave}` : "Mission"}
        </Kicker>
        <span
          className={`flex items-center gap-0.5 font-display text-base text-toon-sm ${info.failed ? "text-blood-400" : "text-gold-300"}`}
        >
          {info.failed ? (
            "실패"
          ) : (
            <>
              <Icon name="coin" />+{info.def.rewardGold}
            </>
          )}
        </span>
      </div>
      <div className="mt-1 font-display text-lg leading-tight text-parchment-50 text-toon-sm">{info.def.name}</div>
      <div className="text-xs text-parchment-100">
        {info.def.description || describeMissionCondition(info.def.condition)}
      </div>
      {info.progress && (
        <div className="mt-1.5 inline-block rounded-lg bg-line/40 px-2 py-0.5 text-xs text-gold-200">{info.progress}</div>
      )}
    </div>
  );
}
