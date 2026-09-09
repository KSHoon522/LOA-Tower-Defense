import { BASE_CRIT_CHANCE, BASE_CRIT_DAMAGE, DEFENSE_K } from "./constants";
import type { DamageType } from "./types";
import { chance } from "./rng";

/**
 * 방어력/마법방어력 기반 피해 계산
 * 감소율 = def / (def + K)  →  def 100 = 50% 감소
 */
export function mitigate(raw: number, defense: number, type: DamageType): number {
  void type; // 물리/마법 모두 동일 공식, 참조하는 방어 스탯만 다름 (호출부에서 선택)
  const reduction = Math.max(0, defense) / (Math.max(0, defense) + DEFENSE_K);
  return raw * (1 - reduction);
}

export interface CritResult {
  damage: number;
  crit: boolean;
}

/** 치명타 판정 적용 */
export function rollCrit(
  baseDamage: number,
  bonusCritChance: number,
  bonusCritDamage: number
): CritResult {
  const critChance = BASE_CRIT_CHANCE + bonusCritChance;
  if (chance(critChance)) {
    const mult = (BASE_CRIT_DAMAGE + bonusCritDamage) / 100;
    return { damage: baseDamage * mult, crit: true };
  }
  return { damage: baseDamage, crit: false };
}

/** 타워의 주 데미지 타입: 더 높은 공격력 쪽 */
export function primaryDamageType(atk: number, magicAtk: number): DamageType {
  return magicAtk > atk ? "magical" : "physical";
}
