import {
  FUSION_JACKPOT_PCT,
  FUSION_PARENT_REGION_PCT,
  GRADE_ORDER,
  MAX_FUSION_GRADE,
} from "./constants";
import { jobPassiveValue } from "./gacha";
import type { Grade, JobDef, Region, TowerDef } from "./types";
import type { Rng } from "./rng";

export interface FusionOutcome {
  def: TowerDef;
  jackpot: boolean; // 2단계 상위 등급 당첨 여부
  resultGrade: Grade;
  resultRegion: Region;
}

/** 두 캐릭터가 합성 가능한지 (같은 등급 + 결과 등급이 전설 이하) */
export function canFuse(a: TowerDef, b: TowerDef): boolean {
  if (a.grade !== b.grade) return false;
  const idx = GRADE_ORDER.indexOf(a.grade);
  const maxIdx = GRADE_ORDER.indexOf(MAX_FUSION_GRADE);
  return idx + 1 <= maxIdx;
}

/**
 * 지역 상속: 부모A 40%, 부모B 40%, 그 외 지역 20%
 * (다중 시너지 캐릭터는 보유 지역 중 하나를 랜덤으로 대표 지역으로 사용)
 */
function inheritRegion(rng: Rng, a: TowerDef, b: TowerDef, allRegions: Region[]): Region {
  const regionA = rng.pick(a.regions);
  const regionB = rng.pick(b.regions);
  const others = allRegions.filter((r) => r !== regionA && r !== regionB);
  const roll = rng.next() * 100;
  if (roll < FUSION_PARENT_REGION_PCT) return regionA;
  if (roll < FUSION_PARENT_REGION_PCT * 2) return regionB;
  if (others.length === 0) return rng.next() < 0.5 ? regionA : regionB;
  return rng.pick(others);
}

/**
 * 합성 실행.
 * - 결과 등급: 1단계 상위. 1%(직업 보너스 가산) 확률로 2단계 상위 (전설 상한)
 * - 결과 지역: 부모 상속 40/40/20
 * - 해당 등급+지역 캐릭터가 없으면 등급 내 전체에서 랜덤 (fallback)
 */
export function fuse(
  rng: Rng,
  a: TowerDef,
  b: TowerDef,
  pool: TowerDef[],
  job: JobDef | null
): FusionOutcome | null {
  if (!canFuse(a, b)) return null;

  const idx = GRADE_ORDER.indexOf(a.grade);
  const maxIdx = GRADE_ORDER.indexOf(MAX_FUSION_GRADE);

  const jackpotBonus = jobPassiveValue(job, "fusion_jackpot_pct");
  const jackpot = idx + 2 <= maxIdx && rng.chance(FUSION_JACKPOT_PCT + jackpotBonus);

  const resultGrade = GRADE_ORDER[Math.min(idx + (jackpot ? 2 : 1), maxIdx)];

  const gradePool = pool.filter((t) => t.grade === resultGrade);
  if (gradePool.length === 0) return null;

  const allRegions = Array.from(new Set(gradePool.flatMap((t) => t.regions)));
  const resultRegion = inheritRegion(rng, a, b, allRegions);

  const regionPool = gradePool.filter((t) => t.regions.includes(resultRegion));
  const def = rng.pick(regionPool.length > 0 ? regionPool : gradePool);

  return { def, jackpot, resultGrade, resultRegion };
}
