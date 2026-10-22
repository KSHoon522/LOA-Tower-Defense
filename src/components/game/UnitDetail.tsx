"use client";

import GradeSlot, { BOSS_PALETTE, FOE_PALETTE } from "@/components/ui/GradeSlot";
import Icon, { type IconName } from "@/components/ui/Icon";
import { BASE_CRIT_CHANCE, GRADE_COLOR, GRADE_LABEL } from "@/game/constants";
import type { GameEngine } from "@/game/engine";
import type { EnemyUnit, TowerDef, TowerUnit } from "@/game/types";
import { TRAIT_ICON, traitText } from "./labels";

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-ink-950/50 px-1.5 py-1">
      <Icon name={icon} className={`shrink-0 text-[13px] ${tone}`} />
      <div className="min-w-0 leading-none">
        <div className="text-[9px] text-parchment-500">{label}</div>
        <div className="mt-0.5 truncate text-xs font-bold text-parchment-100">{value}</div>
      </div>
    </div>
  );
}

/** 아군 캐릭터 정보 카드 본문 */
export function TowerDetail({
  engine,
  unit,
  def,
  regionColor,
  compact = false,
}: {
  engine: GameEngine;
  unit: TowerUnit;
  def: TowerDef;
  regionColor: Map<string, string>;
  /** 모바일 카드: 핵심 수치만, 스킬 설명 생략 */
  compact?: boolean;
}) {
  const manaRatio = def.maxMana > 0 ? Math.min(1, unit.mana / def.maxMana) : 0;
  const magical = def.magicAtk > def.atk;
  return (
    <div>
      <div className="flex gap-3">
        <GradeSlot grade={def.grade} appearance={def.appearance} size={compact ? 44 : 56} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold" style={{ color: GRADE_COLOR[def.grade] }}>
            {GRADE_LABEL[def.grade]}
          </div>
          <div className="truncate font-serif text-base font-bold leading-tight text-parchment-50">
            {def.name}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {def.regions.map((r) => (
              <span
                key={r}
                className="rounded px-1.5 py-px text-[10px] font-bold"
                style={{
                  color: regionColor.get(r) ?? "#cfa24e",
                  backgroundColor: `${regionColor.get(r) ?? "#cfa24e"}1f`,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {compact ? (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {magical ? (
            <Stat icon="orb" label="마법" value={Math.round(engine.effectiveMagicAtk(unit, def))} tone="text-[#c4a1ff]" />
          ) : (
            <Stat icon="sword" label="공격력" value={Math.round(engine.effectiveAtk(unit, def))} tone="text-gold-400" />
          )}
          <Stat icon="bolt" label="공속" value={`${engine.effectiveAttackSpeed(unit, def).toFixed(2)}/s`} tone="text-[#ffd76a]" />
          <Stat icon="range" label="사거리" value={engine.effectiveRange(unit, def).toFixed(1)} tone="text-ark-400" />
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-3 gap-1">
          <Stat icon="sword" label="공격력" value={Math.round(engine.effectiveAtk(unit, def))} tone="text-gold-400" />
          <Stat icon="orb" label="마법" value={Math.round(engine.effectiveMagicAtk(unit, def))} tone="text-[#c4a1ff]" />
          <Stat icon="bolt" label="공속" value={`${engine.effectiveAttackSpeed(unit, def).toFixed(2)}/s`} tone="text-[#ffd76a]" />
          <Stat icon="range" label="사거리" value={engine.effectiveRange(unit, def).toFixed(1)} tone="text-ark-400" />
          <Stat icon="star" label="치명" value={`${BASE_CRIT_CHANCE + engine.effectiveCritChance(def)}%`} tone="text-[#ffb35c]" />
          <Stat icon="skull" label="처치" value={unit.tile ? unit.kills : "-"} tone="text-parchment-400" />
        </div>
      )}

      <div className="mt-2 rounded-lg border border-ark-500/20 bg-ark-500/[0.06] p-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-bold text-ark-300">{def.skill.name}</span>
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-parchment-500">
            <Icon name="drop" className="text-ark-400" />
            {Math.floor(unit.mana)}/{def.maxMana}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-950/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ark-500 to-ark-300 transition-[width] duration-150"
            style={{ width: `${manaRatio * 100}%` }}
          />
        </div>
        {def.skill.description && !compact && (
          <p className="mt-1 text-[11px] leading-snug text-parchment-400">{def.skill.description}</p>
        )}
      </div>
    </div>
  );
}

/** 적 정보 카드 본문 */
export function EnemyDetail({ engine, enemy }: { engine: GameEngine; enemy: EnemyUnit }) {
  const def = engine.enemyDefs.get(enemy.defId);
  if (!def) return null;
  const ratio = Math.max(0, enemy.hp / enemy.maxHp);
  return (
    <div>
      <div className="flex gap-3">
        <GradeSlot palette={enemy.isBoss ? BOSS_PALETTE : FOE_PALETTE} appearance={def.appearance} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10px] font-bold text-blood-400">
            {enemy.isBoss ? (
              <>
                <Icon name="crown" /> 보스
              </>
            ) : (
              "적"
            )}
          </div>
          <div className="truncate font-serif text-base font-bold leading-tight text-parchment-50">
            {def.name}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-950/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blood-600 to-blood-400"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-parchment-400">
            {Math.max(0, Math.round(enemy.hp)).toLocaleString()} / {enemy.maxHp.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1">
        <Stat icon="shield" label="방어" value={enemy.defense} tone="text-parchment-300" />
        <Stat icon="orb" label="마방" value={enemy.magicDefense} tone="text-[#c4a1ff]" />
        <Stat icon="speed" label="이속" value={enemy.moveSpeed} tone="text-ark-400" />
        <Stat icon="coin" label="골드" value={enemy.goldReward} tone="text-gold-400" />
      </div>
      {def.traits && def.traits.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {def.traits.map((tr, i) => (
            <span key={i} className="chip border-[#c4a1ff]/20 bg-[#c4a1ff]/10 text-[#d9c4ff]">
              <Icon name={TRAIT_ICON[tr.type] ?? "info"} />
              {traitText(tr)}
            </span>
          ))}
        </div>
      )}
      {def.description && (
        <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-parchment-500">{def.description}</p>
      )}
    </div>
  );
}
