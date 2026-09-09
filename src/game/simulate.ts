import { GRADE_ORDER } from "./constants";
import { GameEngine, type EngineOptions } from "./engine";
import { gachaCost } from "./gacha";
import type { Point } from "./types";

/**
 * 밸런스 시뮬레이터
 * - 엔진을 헤드리스로 돌리면서 단순한 자동 플레이 AI가 뽑기/배치/합성/스킬을 수행
 * - 같은 시드면 같은 결과 (엔진이 결정론적)
 */

export interface SimConfig {
  runs: number;
  /** 시드 시작값 (run i → seedBase + i) */
  seedBase?: number;
  /** 시뮬레이션 틱 간격(초). 작을수록 정확, 클수록 빠름 */
  dt?: number;
  /** 런당 최대 게임 시간(초) — 무한 루프 방지 */
  maxSeconds?: number;
  /** 웨이브 사이 AI가 대기하는 시간(초) — 실제 플레이어의 준비 시간 흉내 */
  prepSeconds?: number;
}

export interface SimRunResult {
  seed: number;
  phase: "victory" | "defeat" | "timeout";
  wave: number;
  totalWaves: number;
  lives: number;
  gold: number;
  seconds: number;
  towers: { defId: string; name: string; grade: string; damage: number; kills: number }[];
}

export interface SimSummary {
  runs: number;
  clearRate: number;
  avgWave: number;
  avgLives: number;
  avgGold: number;
  avgSeconds: number;
  /** 웨이브별 패배 횟수 (index = wave) */
  defeatByWave: Record<number, number>;
  /** 캐릭터별 평균 딜량 비중 */
  topTowers: { defId: string; name: string; grade: string; avgShare: number; appearances: number }[];
  results: SimRunResult[];
}

/** 건설 가능 타일의 가치: 사거리 2.5 안에 들어오는 경로 타일 수 */
function scoreTiles(engine: GameEngine): { tile: Point; score: number }[] {
  const { map } = engine;
  const pathTiles: Point[] = [];
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] === "path") pathTiles.push({ x, y });
    }
  }
  const out: { tile: Point; score: number }[] = [];
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] !== "buildable") continue;
      let score = 0;
      for (const p of pathTiles) {
        if (Math.hypot(p.x - x, p.y - y) <= 2.5) score++;
      }
      out.push({ tile: { x, y }, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** 자동 플레이 AI 한 스텝 (준비 단계 + 전투 중 주기적으로 호출) */
function aiStep(engine: GameEngine, tileRank: { tile: Point; score: number }[]) {
  // 1) 합성: 가능한 쌍이 있으면 낮은 등급부터 합성
  let fused = true;
  let guard = 0;
  while (fused && guard++ < 20) {
    fused = false;
    const all = [...engine.bench, ...engine.placed].sort(
      (a, b) =>
        GRADE_ORDER.indexOf(engine.towerDefs.get(a.defId)!.grade) -
        GRADE_ORDER.indexOf(engine.towerDefs.get(b.defId)!.grade)
    );
    for (const u of all) {
      const cands = engine.fusionCandidates(u.uid);
      if (cands.length > 0) {
        engine.fuseUnits(u.uid, cands[0]);
        fused = true;
        break;
      }
    }
  }

  // 2) 뽑기: 가장 싼 뽑기를 골드가 허용하는 만큼 (대기석 여유 시)
  const cheapest = engine.gachaDefs
    .filter((g) => g.regionMode !== "select")
    .sort((a, b) => gachaCost(a, engine.job) - gachaCost(b, engine.job))[0];
  if (cheapest) {
    guard = 0;
    while (engine.bench.length < 9 && engine.canAffordGacha(cheapest.id) && guard++ < 30) {
      if (!engine.buyGacha(cheapest.id)) break;
    }
  }

  // 3) 배치: 대기석 유닛을 가치 높은 빈 타일부터
  for (const u of [...engine.bench]) {
    const spot = tileRank.find((t) => engine.isTileBuildable(t.tile.x, t.tile.y));
    if (!spot) break;
    engine.placeTower(u.uid, spot.tile.x, spot.tile.y);
  }

  // 4) 직업 액티브 스킬
  const boss = engine.enemies.find((e) => e.isBoss);
  for (const { index, skill } of engine.activeJobSkills()) {
    if (engine.jobSkillCooldownLeft(index) > 0 || engine.jobSkillUsesLeft <= 0) continue;
    const eff = skill.effect;
    if (eff.type === "gold_grant") {
      engine.castJobSkill(index);
    } else if (eff.type === "buff_all") {
      if (boss || engine.enemies.length >= 6) engine.castJobSkill(index);
    } else if (eff.type === "damage_area") {
      if (engine.enemies.length >= 5 || boss) {
        const target = boss ?? engine.enemies[0];
        if (target) engine.castJobSkill(index, target.pos);
      }
    }
  }
}

export function simulateOne(opts: EngineOptions, seed: number, cfg: SimConfig): SimRunResult {
  const dt = cfg.dt ?? 1 / 30;
  const maxSeconds = cfg.maxSeconds ?? 1800;
  const prepSeconds = cfg.prepSeconds ?? 1;

  const engine = new GameEngine({ ...opts, seed });
  const tileRank = scoreTiles(engine);
  let seconds = 0;
  let sinceAi = 0;
  let prepTimer = 0;

  while (engine.phase !== "victory" && engine.phase !== "defeat" && seconds < maxSeconds) {
    if (engine.phase === "prep") {
      aiStep(engine, tileRank);
      prepTimer += dt;
      if (prepTimer >= prepSeconds && engine.canStartWave()) {
        engine.startWave();
        prepTimer = 0;
      }
    } else {
      sinceAi += dt;
      if (sinceAi >= 2) {
        aiStep(engine, tileRank);
        sinceAi = 0;
      }
    }
    engine.tick(dt);
    seconds += dt;
    // 이펙트/텍스트는 시뮬레이션에 불필요 — 메모리 절약
    engine.effects.length = 0;
    engine.floatingTexts.length = 0;
  }

  const phase: SimRunResult["phase"] =
    engine.phase === "victory" || engine.phase === "defeat" ? engine.phase : "timeout";

  return {
    seed,
    phase,
    wave: engine.wave,
    totalWaves: engine.totalWaves,
    lives: engine.lives,
    gold: engine.gold,
    seconds,
    towers: engine.towerStats().map((s) => ({
      defId: s.def.id,
      name: s.def.name,
      grade: s.def.grade,
      damage: s.damage,
      kills: s.kills,
    })),
  };
}

export function summarize(results: SimRunResult[]): SimSummary {
  const runs = results.length || 1;
  const clears = results.filter((r) => r.phase === "victory").length;
  const defeatByWave: Record<number, number> = {};
  for (const r of results) {
    if (r.phase === "defeat") defeatByWave[r.wave] = (defeatByWave[r.wave] ?? 0) + 1;
  }

  // 캐릭터별 평균 딜 비중 (같은 캐릭터 여러 마리는 합산)
  const acc = new Map<string, { name: string; grade: string; share: number; appearances: number }>();
  for (const r of results) {
    const total = r.towers.reduce((s, t) => s + t.damage, 0) || 1;
    const byDef = new Map<string, { name: string; grade: string; damage: number }>();
    for (const t of r.towers) {
      const cur = byDef.get(t.defId) ?? { name: t.name, grade: t.grade, damage: 0 };
      cur.damage += t.damage;
      byDef.set(t.defId, cur);
    }
    for (const [defId, t] of Array.from(byDef.entries())) {
      const cur = acc.get(defId) ?? { name: t.name, grade: t.grade, share: 0, appearances: 0 };
      cur.share += t.damage / total;
      cur.appearances++;
      acc.set(defId, cur);
    }
  }
  const topTowers = Array.from(acc.entries())
    .map(([defId, v]) => ({
      defId,
      name: v.name,
      grade: v.grade,
      avgShare: v.share / runs,
      appearances: v.appearances,
    }))
    .sort((a, b) => b.avgShare - a.avgShare)
    .slice(0, 10);

  return {
    runs: results.length,
    clearRate: clears / runs,
    avgWave: results.reduce((s, r) => s + r.wave, 0) / runs,
    avgLives: results.reduce((s, r) => s + r.lives, 0) / runs,
    avgGold: results.reduce((s, r) => s + r.gold, 0) / runs,
    avgSeconds: results.reduce((s, r) => s + r.seconds, 0) / runs,
    defeatByWave,
    topTowers,
    results,
  };
}

/** 동기 실행 (테스트/스크립트용) */
export function runSimulation(opts: EngineOptions, cfg: SimConfig): SimSummary {
  const base = cfg.seedBase ?? 1;
  const results: SimRunResult[] = [];
  for (let i = 0; i < cfg.runs; i++) results.push(simulateOne(opts, base + i, cfg));
  return summarize(results);
}

/** 비동기 실행 (브라우저 UI가 멈추지 않도록 런 사이에 양보) */
export async function runSimulationAsync(
  opts: EngineOptions,
  cfg: SimConfig,
  onProgress?: (done: number, total: number, last: SimRunResult) => void,
  shouldStop?: () => boolean
): Promise<SimSummary> {
  const base = cfg.seedBase ?? 1;
  const results: SimRunResult[] = [];
  for (let i = 0; i < cfg.runs; i++) {
    if (shouldStop?.()) break;
    const r = simulateOne(opts, base + i, cfg);
    results.push(r);
    onProgress?.(i + 1, cfg.runs, r);
    await new Promise((res) => setTimeout(res, 0));
  }
  return summarize(results);
}
