import type {
  ActiveSynergy,
  JobDef,
  Region,
  SynergyDef,
  SynergyEffectType,
  TowerDef,
  TowerUnit,
} from "./types";

/**
 * 배치된 타워 기준 시너지 계산 (TFT 방식: 서로 다른 캐릭터만 카운트)
 * - 캐릭터는 여러 지역 시너지를 가질 수 있으며, 보유한 모든 지역에 카운트된다.
 * - 직업의 synergyRegion은 해당 지역 카운트 +1
 */
export function computeSynergies(
  placedTowers: TowerUnit[],
  towerDefs: Map<string, TowerDef>,
  synergyDefs: SynergyDef[],
  job: JobDef | null
): ActiveSynergy[] {
  const uniqueByRegion = new Map<Region, Set<string>>();
  for (const t of placedTowers) {
    if (!t.tile) continue;
    const def = towerDefs.get(t.defId);
    if (!def) continue;
    for (const region of def.regions) {
      if (!uniqueByRegion.has(region)) uniqueByRegion.set(region, new Set());
      uniqueByRegion.get(region)!.add(def.id);
    }
  }

  const results: ActiveSynergy[] = [];
  for (const syn of synergyDefs) {
    let count = uniqueByRegion.get(syn.region)?.size ?? 0;
    if (job?.synergyRegion === syn.region && count > 0) count += 1;

    let activeTierIndex = -1;
    syn.tiers.forEach((tier, i) => {
      if (count >= tier.count) activeTierIndex = i;
    });

    if (count > 0) {
      results.push({
        synergyId: syn.id,
        region: syn.region,
        name: syn.name,
        color: syn.color ?? "#a3a3a3",
        count,
        activeTierIndex,
        tiers: syn.tiers,
        description: syn.description,
      });
    }
  }
  results.sort((a, b) => b.count - a.count);
  return results;
}

/**
 * 발동 중인 모든 시너지의 효과 합산 (전체 타워에 적용)
 * 시너지 발동 조건은 지역별 캐릭터 수지만, 효과는 아군 전체가 받는다.
 */
export function synergyBonus(
  active: ActiveSynergy[],
  type: SynergyEffectType
): number {
  let total = 0;
  for (const syn of active) {
    if (syn.activeTierIndex < 0) continue;
    for (const eff of syn.tiers[syn.activeTierIndex].effects) {
      if (eff.type === type) total += eff.value;
    }
  }
  return total;
}
