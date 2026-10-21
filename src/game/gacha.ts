import { GRADE_ORDER, SELL_BASE_GOLD, SELL_REFUND_PCT } from "./constants";
import type { GachaDef, Grade, JobDef, Region, TowerDef } from "./types";
import type { Rng } from "./rng";

/** 직업 패시브 스킬 값 합산 */
export function jobPassiveValue(job: JobDef | null, type: string): number {
  if (!job) return 0;
  return job.skills
    .filter((s) => s.kind === "passive" && s.type === type)
    .reduce((sum, s) => sum + (s.kind === "passive" ? s.value : 0), 0);
}

/** 판매 환급액: 기준 골드 × 등급 배수(2^등급) × 환급률 */
export function sellRefund(grade: Grade): number {
  return Math.round(
    (SELL_BASE_GOLD * Math.pow(2, GRADE_ORDER.indexOf(grade)) * SELL_REFUND_PCT) / 100
  );
}

/** 직업 할인 반영 뽑기 비용 */
export function gachaCost(gacha: GachaDef, job: JobDef | null): number {
  const discount = jobPassiveValue(job, "gacha_discount_pct");
  return Math.max(1, Math.round(gacha.cost * (1 - discount / 100)));
}

/**
 * 뽑기 실행 (데이터 주도)
 * 1) 지역 조건으로 풀 필터 (any/select/fixed) — 다중 시너지 캐릭터는 포함 여부로 판정
 * 2) rates에서 풀에 실제 존재하는 등급만 남기고 가중치 랜덤으로 등급 결정
 * 3) 해당 등급 캐릭터 중 랜덤
 */
export function rollGacha(
  rng: Rng,
  pool: TowerDef[],
  gacha: GachaDef,
  selectedRegion?: Region
): TowerDef | null {
  let filtered = pool;
  if (gacha.regionMode === "fixed" && gacha.fixedRegion) {
    filtered = pool.filter((t) => t.regions.includes(gacha.fixedRegion!));
  } else if (gacha.regionMode === "select") {
    if (!selectedRegion) return null;
    filtered = pool.filter((t) => t.regions.includes(selectedRegion));
  }
  if (filtered.length === 0) return null;

  const available = new Set(filtered.map((t) => t.grade));
  const candidates = GRADE_ORDER.filter(
    (g: Grade) => available.has(g) && (gacha.rates[g] ?? 0) > 0
  );
  if (candidates.length === 0) return null;

  const grade = rng.weighted(
    candidates.map((g) => ({ item: g, weight: gacha.rates[g] ?? 0 }))
  );
  return rng.pick(filtered.filter((t) => t.grade === grade));
}
