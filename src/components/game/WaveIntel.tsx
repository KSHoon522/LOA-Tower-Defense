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

function Kicker({ children, tone = "text-gold-500/80" }: { children: React.ReactNode; tone?: string }) {
  return (
    <div className={`flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.25em] ${tone}`}>
      {children}
    </div>
  );
}

/** 다가오는(또는 싸우는 중인) 보스 */
export function BossCard({ boss }: { boss: BossInfo }) {
  const alive = boss.alive;
  return (
    <div className="relative overflow-hidden rounded-xl border border-blood-500/25 bg-gradient-to-br from-blood-600/15 to-transparent p-2.5">
      <Kicker tone="text-blood-400">
        <Icon name="crown" />
        {alive ? "Boss Battle" : `Boss · Wave ${boss.wave}`}
      </Kicker>
      <div className="mt-2 flex gap-2.5">
        <GradeSlot palette={BOSS_PALETTE} appearance={boss.def.appearance} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-sm font-bold text-parchment-50">{boss.def.name}</div>
          {alive ? (
            <>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-950/80">
                <div
                  data-boss-hp
                  className="h-full rounded-full bg-gradient-to-r from-blood-600 to-blood-400"
                  style={{ width: `${Math.max(0, (alive.hp / boss.maxHp) * 100)}%` }}
                />
              </div>
              <div className="mt-0.5 text-[10px] text-parchment-400">
                {Math.max(0, Math.round(alive.hp)).toLocaleString()} / {boss.maxHp.toLocaleString()}
              </div>
            </>
          ) : (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-parchment-400">
              <Icon name="heart" className="text-blood-400" />
              예상 체력 {boss.maxHp.toLocaleString()}
            </div>
          )}
          <div className="mt-1 flex gap-2.5 text-[10px] text-parchment-500">
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
            <span key={i} className="chip border-blood-500/20 bg-blood-600/10 text-blood-400">
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
    <div className="rounded-xl border border-white/5 bg-ink-950/40 p-2.5">
      <Kicker>
        <Icon name="flag" />
        Next · Wave {wave}
      </Kicker>
      <div className="mt-2 space-y-1">
        {preview.map(({ def, count }) => (
          <div key={def.id} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base ${
                def.isBoss ? "bg-blood-600/30" : "bg-ink-800"
              }`}
            >
              {def.appearance.icon}
            </span>
            <span className={`min-w-0 flex-1 truncate font-semibold ${def.isBoss ? "text-blood-400" : "text-parchment-100"}`}>
              {def.name}
            </span>
            {def.traits?.map((t, i) => (
              <Icon key={i} name={TRAIT_ICON[t.type] ?? "info"} className="shrink-0 text-[#c4a1ff]" title={traitText(t)} />
            ))}
            <span className="shrink-0 font-display font-bold text-parchment-300">×{count}</span>
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
      className={`rounded-xl border p-2.5 transition duration-300 ${
        info.failed ? "border-blood-500/25 bg-blood-600/10 opacity-80" : "border-[#a78bfa]/25 bg-[#a78bfa]/[0.07]"
      }`}
    >
      <div className="flex items-center justify-between">
        <Kicker tone={info.failed ? "text-blood-400" : "text-[#c4a1ff]"}>
          <Icon name="target" />
          {info.upcoming ? `Mission · Wave ${wave}` : "Mission"}
        </Kicker>
        <span className={`flex items-center gap-0.5 text-xs font-bold ${info.failed ? "text-blood-400" : "text-gold-300"}`}>
          {info.failed ? (
            "실패"
          ) : (
            <>
              <Icon name="coin" />+{info.def.rewardGold}
            </>
          )}
        </span>
      </div>
      <div className="mt-1 font-serif text-sm font-bold text-parchment-50">{info.def.name}</div>
      <div className="text-[11px] text-parchment-400">
        {info.def.description || describeMissionCondition(info.def.condition)}
      </div>
      {info.progress && <div className="mt-1 text-[11px] font-bold text-[#d9c4ff]">{info.progress}</div>}
    </div>
  );
}
