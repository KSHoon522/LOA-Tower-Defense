import { describe, expect, it } from "vitest";
import { Rng } from "../rng";
import { gachaCost, rollGacha } from "../gacha";
import { canFuse, fuse } from "../fusion";
import { computeSynergies, synergyBonus } from "../synergy";
import { GRADE_ORDER } from "../constants";
import type { GachaDef, TowerDef, TowerUnit } from "../types";
import { loadData } from "./helpers";

const data = loadData();

describe("Rng", () => {
  it("같은 시드는 같은 순서를 만든다", () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("상태를 저장/복원하면 이어서 같은 값을 만든다", () => {
    const a = new Rng(7);
    for (let i = 0; i < 10; i++) a.next();
    const state = a.getState();
    const expected = [a.next(), a.next(), a.next()];
    const b = new Rng(0);
    b.setState(state);
    expect([b.next(), b.next(), b.next()]).toEqual(expected);
  });

  it("chance(0)은 항상 false, chance(100)은 항상 true", () => {
    const r = new Rng(1);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(100)).toBe(true);
    }
  });
});

describe("gacha", () => {
  const normal = data.gachas.find((g) => g.id === "gacha-normal")!;
  const rarePlus = data.gachas.find((g) => g.id === "gacha-rare-plus")!;

  it("희귀 이상 뽑기는 희귀 미만을 절대 주지 않는다", () => {
    const rng = new Rng(1);
    const minIdx = GRADE_ORDER.indexOf("rare");
    for (let i = 0; i < 500; i++) {
      const def = rollGacha(rng, data.towers, rarePlus)!;
      expect(GRADE_ORDER.indexOf(def.grade)).toBeGreaterThanOrEqual(minIdx);
    }
  });

  it("지역 선택 뽑기는 해당 지역 캐릭터만 준다 (다중 시너지 포함)", () => {
    const rng = new Rng(2);
    const region = data.gachas.find((g) => g.regionMode === "select")!;
    for (let i = 0; i < 200; i++) {
      const def = rollGacha(rng, data.towers, region, "베른")!;
      expect(def.regions).toContain("베른");
    }
    expect(rollGacha(rng, data.towers, region)).toBeNull();
  });

  it("확률 0인 등급은 등장하지 않는다", () => {
    const rng = new Rng(3);
    const onlyCommon: GachaDef = { ...normal, id: "t", rates: { common: 100 } };
    for (let i = 0; i < 100; i++) expect(rollGacha(rng, data.towers, onlyCommon)!.grade).toBe("common");
  });

  it("직업 할인이 비용에 반영된다", () => {
    const discountJob = {
      id: "t-job",
      name: "테스트",
      skills: [{ kind: "passive" as const, name: "할인", type: "gacha_discount_pct" as const, value: 25 }],
    };
    expect(gachaCost(normal, discountJob)).toBe(Math.round(normal.cost * 0.75));
    expect(gachaCost(normal, null)).toBe(normal.cost);
  });
});

describe("fusion", () => {
  const byGrade = (g: string) => data.towers.filter((t) => t.grade === g);

  it("같은 등급만 합성 가능하고 전설은 합성 불가", () => {
    const c = byGrade("common");
    const l = byGrade("legendary");
    expect(canFuse(c[0], c[1])).toBe(true);
    expect(canFuse(c[0], byGrade("rare")[0])).toBe(false);
    expect(canFuse(l[0], l[1] ?? l[0])).toBe(false);
  });

  it("결과는 1단계 상위 (잭팟 시 2단계), 전설을 넘지 않는다", () => {
    const rng = new Rng(5);
    const heroes = byGrade("hero");
    for (let i = 0; i < 200; i++) {
      const r = fuse(rng, heroes[0], heroes[1], data.towers, null)!;
      expect(r.def.grade).toBe("legendary");
    }
  });

  it("지역 상속 확률이 대략 40/40/20 이다", () => {
    const rng = new Rng(9);
    const a = byGrade("common").find((t) => t.regions.includes("베른"))!;
    const b = byGrade("common").find((t) => t.regions.includes("슈샤이어"))!;
    let fromA = 0;
    let fromB = 0;
    let other = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      const r = fuse(rng, a, b, data.towers, null)!;
      if (r.resultRegion === "베른") fromA++;
      else if (r.resultRegion === "슈샤이어") fromB++;
      else other++;
    }
    expect(fromA / N).toBeGreaterThan(0.33);
    expect(fromA / N).toBeLessThan(0.47);
    expect(fromB / N).toBeGreaterThan(0.33);
    expect(fromB / N).toBeLessThan(0.47);
    expect(other / N).toBeGreaterThan(0.13);
    expect(other / N).toBeLessThan(0.27);
  });
});

describe("synergy", () => {
  const towerDefs = new Map(data.towers.map((t) => [t.id, t]));
  const unit = (defId: string, x: number): TowerUnit => ({
    uid: `${defId}-${x}`,
    defId,
    tile: { x, y: 0 },
    mana: 0,
    nextAttackAt: 0,
    kills: 0,
    totalDamage: 0,
    buffs: [],
    attackAnim: 0,
    skillAnimUntil: 0,
    aimAngle: 0,
    targetMode: "first",
  });

  it("같은 캐릭터 2개는 1로 센다 (TFT 방식)", () => {
    const res = computeSynergies([unit("tw-brawler", 0), unit("tw-brawler", 1)], towerDefs, data.synergies, null);
    expect(res.find((s) => s.region === "애니츠")?.count).toBe(1);
  });

  it("다중 시너지 캐릭터는 모든 지역에 카운트된다", () => {
    // 시드 데이터 편집과 무관하게: 시너지가 정의된 두 지역을 가진 캐릭터를 직접 만든다
    const regions = data.synergies.slice(0, 2).map((s) => s.region);
    const multi: TowerDef = { ...data.towers[0], id: "tw-test-multi", regions };
    const defs = new Map(towerDefs).set(multi.id, multi);
    const res = computeSynergies([unit(multi.id, 0)], defs, data.synergies, null);
    for (const r of regions) {
      expect(res.find((s) => s.region === r)?.count).toBe(1);
    }
  });

  it("직업 시너지 지역은 +1, 발동 효과는 전체 합산", () => {
    const berserker = data.jobs.find((j) => j.id === "job-berserker")!; // 애니츠 +1
    const res = computeSynergies([unit("tw-brawler", 0)], towerDefs, data.synergies, berserker);
    const anikka = res.find((s) => s.region === "애니츠")!;
    expect(anikka.count).toBe(2);
    expect(anikka.activeTierIndex).toBe(0);
    expect(synergyBonus(res, "atk_speed_pct")).toBeGreaterThan(0);
  });
});

// 타입 사용 확인용 (미사용 경고 방지)
void ((_: TowerDef) => _);
