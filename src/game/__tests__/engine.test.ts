import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine";
import { DIFFICULTY } from "../constants";
import { runSimulation } from "../simulate";
import type { EnemyDef, StageDef } from "../types";
import { baseOptions, firstBuildable, loadData } from "./helpers";

const data = loadData();

function tick(engine: GameEngine, seconds: number, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) engine.tick(dt);
}

function placeOne(engine: GameEngine, defId: string) {
  engine.gold = 100000;
  const spot = firstBuildableFree(engine);
  // 대기석에 직접 주입 (뽑기 확률 무관하게 테스트)
  engine.bench.push({
    uid: `t-${defId}-${engine.bench.length}`,
    defId,
    tile: null,
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
  const uid = engine.bench[engine.bench.length - 1].uid;
  expect(engine.placeTower(uid, spot.x, spot.y)).toBe(true);
  return engine.placed.find((t) => t.uid === uid)!;
}

/** 경로 타일에 가장 가까운 빈 건설 타일 (맵 구성과 무관하게 사거리 안에 적이 들어오도록) */
function firstBuildableFree(engine: GameEngine) {
  const pathTiles: { x: number; y: number }[] = [];
  for (let y = 0; y < engine.map.rows; y++) {
    for (let x = 0; x < engine.map.cols; x++) {
      if (engine.map.tiles[y][x] === "path") pathTiles.push({ x, y });
    }
  }
  let best: { x: number; y: number } | null = null;
  let bestScore = -1;
  for (let y = 0; y < engine.map.rows; y++) {
    for (let x = 0; x < engine.map.cols; x++) {
      if (!engine.isTileBuildable(x, y)) continue;
      const score = pathTiles.filter((p) => Math.hypot(p.x - x, p.y - y) <= 2.5).length;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  if (!best) throw new Error("빈 타일 없음");
  return best;
}

describe("GameEngine 기본", () => {
  it("난이도에 따라 목숨/골드/스킬 횟수가 설정된다", () => {
    const e = new GameEngine(baseOptions({ difficulty: "nightmare" }));
    expect(e.lives).toBe(DIFFICULTY.nightmare.lives);
    expect(e.gold).toBe(DIFFICULTY.nightmare.startGold);
    expect(e.jobSkillUsesLeft).toBe(DIFFICULTY.nightmare.jobSkillUses);
  });

  it("마나는 웨이브 진행 중에만 회복된다", () => {
    const e = new GameEngine(baseOptions());
    const unit = placeOne(e, "tw-recruit");
    tick(e, 5);
    expect(unit.mana).toBe(0);
    e.startWave();
    tick(e, 3);
    expect(unit.mana).toBeGreaterThan(0);
  });

  it("직업 액티브 스킬은 난이도 횟수만큼만 사용된다", () => {
    const bard = data.jobs.find((j) => j.id === "job-bard")!;
    const e = new GameEngine(baseOptions({ job: bard, difficulty: "nightmare" }));
    const idx = e.activeJobSkills()[0].index;
    let casts = 0;
    for (let i = 0; i < 20; i++) {
      if (e.castJobSkill(idx)) casts++;
      e.time += 1000;
    }
    expect(casts).toBe(DIFFICULTY.nightmare.jobSkillUses);
    expect(e.jobSkillUsesLeft).toBe(0);
  });

  it("타워 이동은 건설 가능 타일로만 가능하다", () => {
    const e = new GameEngine(baseOptions());
    const unit = placeOne(e, "tw-recruit");
    const next = firstBuildableFree(e);
    expect(e.moveTower(unit.uid, next.x, next.y)).toBe(true);
    const path = e.map.paths[0][0];
    expect(e.moveTower(unit.uid, path.x, path.y)).toBe(false);
  });

  it("웨이브 클리어 시 이자가 지급된다", () => {
    const e = new GameEngine(baseOptions({ stage: { ...baseOptions().stage!, waves: 1, enemyIds: ["en-goblin"] } }));
    placeOne(e, "tw-esther-luteran"); // 강력한 타워로 확실히 클리어
    e.gold = 1000;
    e.startWave();
    tick(e, 60);
    expect(e.phase).toBe("victory");
    expect(e.gold).toBeGreaterThan(1000 + 25); // 클리어 골드 + 이자
  });
});

describe("저장/복원 결정론", () => {
  it("스냅샷 복원 후 같은 입력에 같은 결과를 낸다", () => {
    const a = new GameEngine(baseOptions({ seed: 777 }));
    a.gold = 5000;
    for (let i = 0; i < 6; i++) a.buyGacha("gacha-normal");
    for (const u of [...a.bench]) {
      const s = firstBuildableFree(a);
      a.placeTower(u.uid, s.x, s.y);
    }
    a.startWave();
    tick(a, 4);

    const snap = a.serialize();
    const b = GameEngine.restore(baseOptions({ seed: 777 }), snap);

    // 같은 시간만큼 진행
    tick(a, 6);
    tick(b, 6);

    expect(b.gold).toBe(a.gold);
    expect(b.lives).toBe(a.lives);
    expect(b.wave).toBe(a.wave);
    expect(b.phase).toBe(a.phase);
    expect(b.enemies.length).toBe(a.enemies.length);
    expect(b.rng.getState()).toBe(a.rng.getState());
    expect(b.placed.map((t) => t.totalDamage)).toEqual(a.placed.map((t) => t.totalDamage));
  });

  it("같은 시드의 두 엔진은 완전히 같은 뽑기 결과를 낸다", () => {
    const a = new GameEngine(baseOptions({ seed: 31 }));
    const b = new GameEngine(baseOptions({ seed: 31 }));
    a.gold = b.gold = 10000;
    const ra = Array.from({ length: 10 }, () => a.buyGacha("gacha-normal")?.id);
    const rb = Array.from({ length: 10 }, () => b.buyGacha("gacha-normal")?.id);
    expect(ra).toEqual(rb);
  });
});

describe("적 특성", () => {
  const spirit = data.enemies.find((e) => e.id === "en-spirit")!;
  const stealthRange = (spirit.traits?.find((t) => t.type === "stealth") as { revealRange: number }).revealRange;

  it("은신 적은 노출 거리 밖의 타워에게 타겟되지 않는다", () => {
    // 웨이브 1은 일반 웨이브여야 하므로 총 웨이브 3 (마지막/5배수만 보스)
    const stage: StageDef = { ...baseOptions().stage!, waves: 3, enemyIds: ["en-spirit"], waveDefs: undefined };
    const e = new GameEngine(baseOptions({ stage }));
    // 사거리가 노출 거리보다 긴 타워 배치
    const sniper = placeOne(e, "tw-sniper");
    expect(e.towerDefs.get("tw-sniper")!.range).toBeGreaterThan(stealthRange);
    e.startWave();
    tick(e, 2);
    // 적이 사거리 안에 있어도 revealRange 밖이면 공격하지 않음
    const anyFar = e.enemies.some((en) => {
      const d = Math.hypot(en.pos.x - sniper.tile!.x, en.pos.y - sniper.tile!.y);
      return d > stealthRange && d <= e.towerDefs.get("tw-sniper")!.range;
    });
    if (anyFar) {
      // 공격했더라도 대상은 반드시 revealRange 이내여야 함 → 투사체 대상 검사
      for (const p of e.projectiles) {
        const target = e.enemies.find((en) => en.uid === p.targetUid);
        if (!target) continue;
        const d = Math.hypot(target.pos.x - sniper.tile!.x, target.pos.y - sniper.tile!.y);
        expect(d).toBeLessThanOrEqual(stealthRange + 0.5);
      }
    }
  });

  it("분열 적은 사망 시 자식을 스폰한다", () => {
    const slime = data.enemies.find((e) => e.id === "en-slime")!;
    const stage: StageDef = {
      ...baseOptions().stage!,
      waves: 1,
      waveDefs: [{ groups: [{ enemyId: slime.id, count: 3, interval: 0.3 }] }],
    };
    const e = new GameEngine(baseOptions({ stage }));
    placeOne(e, "tw-esther-luteran");
    e.startWave();
    let sawChild = false;
    for (let i = 0; i < 60 * 30 && !sawChild; i++) {
      e.tick(1 / 60);
      if (e.enemies.some((en) => en.defId === "en-slime-small")) sawChild = true;
    }
    expect(sawChild).toBe(true);
  });

  it("재생 특성은 체력을 회복시킨다", () => {
    const golem = data.enemies.find((e) => e.id === "en-boss-golem")!;
    const stage: StageDef = {
      ...baseOptions().stage!,
      waves: 1,
      enemyIds: ["en-goblin"],
      waveDefs: [{ groups: [], bossId: golem.id }],
    };
    const e = new GameEngine(baseOptions({ stage }));
    e.startWave();
    tick(e, 1);
    const boss = e.enemies.find((en) => en.isBoss)!;
    boss.hp = boss.maxHp * 0.5;
    tick(e, 2);
    expect(boss.hp).toBeGreaterThan(boss.maxHp * 0.5);
  });
});

describe("수동 웨이브 / 타겟팅", () => {
  it("waveDefs가 있으면 총 웨이브 수와 구성이 그대로 사용된다", () => {
    const stage: StageDef = {
      ...baseOptions().stage!,
      waves: 99,
      waveDefs: [
        { groups: [{ enemyId: "en-goblin", count: 3, interval: 0.1 }] },
        { groups: [{ enemyId: "en-wolfrider", count: 2, interval: 0.1 }], bossId: "en-boss-demon" },
      ],
    };
    const e = new GameEngine(baseOptions({ stage }));
    expect(e.totalWaves).toBe(2);
    expect(e.isBossWave(1)).toBe(false);
    expect(e.isBossWave(2)).toBe(true);
    const preview = e.wavePreview(2);
    expect(preview.find((p) => p.def.id === "en-wolfrider")?.count).toBe(2);
    expect(preview.some((p) => p.def.isBoss)).toBe(true);
    expect(e.bossPreview()?.wave).toBe(2);
  });

  it("타겟팅 모드를 변경할 수 있다", () => {
    const e = new GameEngine(baseOptions());
    const u = placeOne(e, "tw-recruit");
    expect(u.targetMode).toBe("first");
    e.setTargetMode(u.uid, "boss");
    expect(u.targetMode).toBe("boss");
  });
});

describe("시뮬레이터", () => {
  it("같은 시드는 같은 결과를 내고 요약 통계가 계산된다", () => {
    const stage: StageDef = { ...baseOptions().stage!, waves: 3, waveDefs: undefined };
    const opts = baseOptions({ stage, job: data.jobs[0] });
    const a = runSimulation(opts, { runs: 2, seedBase: 5, dt: 1 / 20 });
    const b = runSimulation(opts, { runs: 2, seedBase: 5, dt: 1 / 20 });
    expect(a.results.map((r) => [r.phase, r.wave, r.gold])).toEqual(
      b.results.map((r) => [r.phase, r.wave, r.gold])
    );
    expect(a.runs).toBe(2);
    expect(a.clearRate).toBeGreaterThanOrEqual(0);
    expect(a.clearRate).toBeLessThanOrEqual(1);
  }, 30000);
});

void ((_: EnemyDef) => _);
