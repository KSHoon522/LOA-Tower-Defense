import type { IconName } from "@/components/ui/Icon";
import type { EnemyTrait, JobPassiveType, SynergyEffect, SynergyEffectType } from "@/game/types";

export const TRAIT_LABEL: Record<EnemyTrait["type"], string> = {
  regen: "재생",
  stealth: "은신",
  split: "분열",
  aura_defense: "방어 오라",
  slow_immune: "둔화 면역",
  stun_immune: "기절 면역",
};

export const TRAIT_ICON: Record<EnemyTrait["type"], IconName> = {
  regen: "drop",
  stealth: "ghost",
  split: "sparkles",
  aura_defense: "shield",
  slow_immune: "speed",
  stun_immune: "star",
};

export function traitText(t: EnemyTrait): string {
  const label = TRAIT_LABEL[t.type] ?? t.type;
  if (t.type === "regen") return `${label} ${t.pctPerSec}%/초`;
  if (t.type === "stealth") return `${label} (${t.revealRange}칸)`;
  if (t.type === "split") return `${label} ×${t.count}`;
  return label;
}

/** 시너지 효과: [이름, 단위] */
const EFFECT_UNIT: Record<SynergyEffectType, [string, string]> = {
  atk_pct: ["물리 공격력", "%"],
  magic_atk_pct: ["마법 공격력", "%"],
  atk_speed_pct: ["공격속도", "%"],
  crit_chance: ["치명타 확률", "%p"],
  crit_damage_pct: ["치명타 피해", "%p"],
  mana_regen_pct: ["마나 회복", "%"],
  range_add: ["사거리", "칸"],
  gold_per_kill: ["처치 골드", "G"],
};

export function effectText(e: SynergyEffect): string {
  const [label, unit] = EFFECT_UNIT[e.type] ?? [e.type, ""];
  return `${label} +${e.value}${unit}`;
}

export const PASSIVE_LABEL: Record<JobPassiveType, string> = {
  start_gold: "시작 골드",
  extra_lives: "목숨",
  gacha_discount_pct: "뽑기 할인 %",
  crit_chance_all: "치명타 확률 %p",
  atk_pct_all: "물리 공격력 %",
  magic_atk_pct_all: "마법 공격력 %",
  atk_speed_pct_all: "공격속도 %",
  crit_damage_pct_all: "치명타 피해 %p",
  mana_regen_pct_all: "마나 회복 %",
  gold_per_kill: "처치당 골드",
  fusion_jackpot_pct: "합성 대성공 %p",
};
