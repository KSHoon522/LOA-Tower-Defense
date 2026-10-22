import { describe, expect, it } from "vitest";
import { GameEngine } from "../engine";
import {
  EARLY_CALL_BASE_GOLD,
  EARLY_CALL_GOLD_PER_ENEMY,
  EARLY_CALL_MAX_GOLD,
  WAVE_CLEAR_GOLD,
} from "../constants";
import type { MissionDef, StageDef, WaveDef } from "../types";
import { baseOptions } from "./helpers";

function tick(engine: GameEngine, seconds: number, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) engine.tick(dt);
}

const MISSIONS: MissionDef[] = [
  { id: "m-leak", name: "철벽", condition: { type: "no_leak" }, rewardGold: 15, waveFilter: "any" },
  { id: "m-skill", name: "봉인", condition: { type: "no_job_skill" }, rewardGold: 10, waveFilter: "normal" },
  { id: "m-few", name: "소수", condition: { type: "max_placed", count: 0 }, rewardGold: 25, waveFilter: "normal" },
  { id: "m-boss", name: "보스", condition: { type: "boss_within", seconds: 30 }, rewardGold: 40, waveFilter: "boss" },
];

function stageWith(waveDefs: WaveDef[]): StageDef {
  return { ...baseOptions().stage!, waves: waveDefs.length, waveDefs };
}

/** 남은 적을 모두 처치한 것으로 처리 (클리어 정산만 검사할 때) */
function wipe(engine: GameEngine) {
  for (const e of engine.enemies) e.dead = true;
}

describe("웨이브 조기 호출", () => {
  it("스폰이 끝나고 적이 남아 있을 때만 호출할 수 있고, 남은 적 수만큼 보너스를 준다", () => {
    const stage = stageWith([
      { groups: [{ enemyId: "en-goblin", count: 5, interval: 0.1 }] },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }] },
    ]);
    const e = new GameEngine(baseOptions({ stage, missions: [] }));
    expect(e.canCallWaveEarly()).toBe(false); // 준비 단계
    e.startWave();
    expect(e.canCallWaveEarly()).toBe(false); // 아직 스폰 중
    tick(e, 1);
    expect(e.canCallWaveEarly()).toBe(true);

    const alive = e.enemies.filter((x) => !x.dead && !x.reached).length;
    const expected = Math.min(EARLY_CALL_MAX_GOLD, EARLY_CALL_BASE_GOLD + alive * EARLY_CALL_GOLD_PER_ENEMY);
    expect(e.earlyCallBonus()).toBe(expected);

    const gold = e.gold;
    e.startWave();
    expect(e.wave).toBe(2);
    expect(e.gold).toBe(gold + expected);
    expect(e.chainedWaves).toBe(1);
    expect(e.canCallWaveEarly()).toBe(false); // 마지막 웨이브는 더 부를 수 없음
  });

  it("이어 붙인 웨이브의 클리어 보상은 적 전멸 시 한 번에 정산된다", () => {
    const stage = stageWith([
      { groups: [{ enemyId: "en-goblin", count: 3, interval: 0.1 }] },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }] },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }] },
    ]);
    const e = new GameEngine(baseOptions({ stage, missions: [] }));
    e.startWave();
    tick(e, 1);
    e.startWave(); // 조기 호출
    tick(e, 1);
    const before = e.gold;
    wipe(e);
    tick(e, 0.1);
    expect(e.phase).toBe("prep");
    expect(e.chainedWaves).toBe(0);
    expect(e.gold).toBeGreaterThanOrEqual(before + WAVE_CLEAR_GOLD * 2);
    expect(e.logs.some((l) => l.text.includes("웨이브 1~2 클리어"))).toBe(true);
  });
});

describe("웨이브 미션", () => {
  it("미션 배정은 시드+웨이브로 결정되고 RNG 상태를 소비하지 않는다", () => {
    const a = new GameEngine(baseOptions({ seed: 11, missions: MISSIONS }));
    const b = new GameEngine(baseOptions({ seed: 11, missions: MISSIONS }));
    const rngBefore = a.rng.getState();
    const ma = Array.from({ length: a.totalWaves }, (_, i) => a.missionFor(i + 1)?.id);
    const mb = Array.from({ length: b.totalWaves }, (_, i) => b.missionFor(i + 1)?.id);
    expect(ma).toEqual(mb);
    expect(a.rng.getState()).toBe(rngBefore);
  });

  it("보스 전용 미션은 보스 웨이브에만, 일반 전용 미션은 일반 웨이브에만 배정된다", () => {
    const e = new GameEngine(baseOptions({ seed: 3, missions: MISSIONS }));
    for (let w = 1; w <= e.totalWaves; w++) {
      const m = e.missionFor(w)!;
      if (e.isBossWave(w)) expect(["any", "boss"]).toContain(m.waveFilter);
      else expect(["any", "normal"]).toContain(m.waveFilter);
    }
  });

  it("수동 웨이브의 missionId가 우선한다", () => {
    const stage = stageWith([{ groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }], missionId: "m-few" }]);
    const e = new GameEngine(baseOptions({ stage, missions: MISSIONS }));
    expect(e.missionFor(1)?.id).toBe("m-few");
  });

  it("목숨을 잃으면 no_leak 미션이 실패하고 보상이 없다", () => {
    const stage = stageWith([{ groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }], missionId: "m-leak" }]);
    const e = new GameEngine(baseOptions({ stage, missions: MISSIONS }));
    const lives = e.lives;
    e.startWave();
    expect(e.mission?.missionId).toBe("m-leak");
    for (let i = 0; i < 60 * 120 && e.phase === "wave"; i++) e.tick(1 / 60);
    expect(e.lives).toBe(lives - 1);
    expect(e.logs.some((l) => l.text.includes("미션 실패"))).toBe(true);
    expect(e.logs.some((l) => l.text.includes("미션 성공"))).toBe(false);
  });

  it("조건을 지키고 전멸시키면 보상을 받는다", () => {
    const stage = stageWith([
      { groups: [{ enemyId: "en-goblin", count: 2, interval: 0.1 }], missionId: "m-skill" },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }] },
    ]);
    const e = new GameEngine(baseOptions({ stage, missions: MISSIONS }));
    e.startWave();
    tick(e, 1);
    const before = e.gold;
    wipe(e);
    tick(e, 0.1);
    expect(e.logs.some((l) => l.text.includes("미션 성공: 봉인"))).toBe(true);
    expect(e.gold).toBeGreaterThanOrEqual(before + 10 + WAVE_CLEAR_GOLD);
    expect(e.mission).toBeNull();
  });

  it("max_placed 미션은 배치 수를 넘으면 즉시 실패한다", () => {
    const stage = stageWith([{ groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }], missionId: "m-few" }]);
    const e = new GameEngine(baseOptions({ stage, missions: MISSIONS }));
    e.gold = 1000;
    e.buyGacha("gacha-normal");
    const tile = (() => {
      for (let y = 0; y < e.map.rows; y++)
        for (let x = 0; x < e.map.cols; x++) if (e.isTileBuildable(x, y)) return { x, y };
      throw new Error("no tile");
    })();
    e.placeTower(e.bench[0].uid, tile.x, tile.y);
    e.startWave();
    tick(e, 0.1);
    expect(e.mission?.status).toBe("failed");
  });

  it("조기 호출한 웨이브에는 미션이 새로 부여되지 않는다", () => {
    const stage = stageWith([
      { groups: [{ enemyId: "en-goblin", count: 3, interval: 0.1 }], missionId: "m-skill" },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }], missionId: "m-leak" },
    ]);
    const e = new GameEngine(baseOptions({ stage, missions: MISSIONS }));
    e.startWave();
    tick(e, 1);
    e.startWave();
    expect(e.mission?.missionId).toBe("m-skill");
    expect(e.mission?.wave).toBe(1);
  });

  it("미션과 조기 호출 상태가 저장/복원된다", () => {
    const stage = stageWith([
      { groups: [{ enemyId: "en-goblin", count: 3, interval: 0.1 }], missionId: "m-skill" },
      { groups: [{ enemyId: "en-goblin", count: 1, interval: 0.1 }] },
    ]);
    const opts = baseOptions({ stage, missions: MISSIONS });
    const a = new GameEngine(opts);
    a.startWave();
    tick(a, 1);
    a.startWave();
    const b = GameEngine.restore(opts, a.serialize());
    expect(b.mission).toEqual(a.mission);
    expect(b.chainedWaves).toBe(1);
  });

  it("미션 필드가 없는 이전 버전 세이브도 복원된다", () => {
    const a = new GameEngine(baseOptions({ missions: MISSIONS }));
    const snap = a.serialize();
    delete snap.mission;
    delete snap.chainedWaves;
    const b = GameEngine.restore(baseOptions({ missions: MISSIONS }), snap);
    expect(b.mission).toBeNull();
    expect(b.chainedWaves).toBe(0);
  });
});

describe("엔진 이벤트", () => {
  it("drainEvents는 쌓인 이벤트를 꺼내고 비운다", () => {
    const e = new GameEngine(baseOptions({ missions: [] }));
    e.gold = 1000;
    e.buyGacha("gacha-normal");
    e.startWave();
    const events = e.drainEvents();
    expect(events).toContain("wave_start");
    expect(events.some((x) => x === "gacha" || x === "gacha_legendary")).toBe(true);
    expect(e.drainEvents()).toEqual([]);
  });

  it("소비하지 않으면 최대 200개까지만 유지한다", () => {
    const e = new GameEngine(baseOptions({ missions: [] }));
    e.gold = 1e9;
    for (let i = 0; i < 400; i++) {
      e.buyGacha("gacha-normal");
      if (e.bench[0]) e.sellTower(e.bench[0].uid);
    }
    expect(e.drainEvents().length).toBe(200);
  });
});
