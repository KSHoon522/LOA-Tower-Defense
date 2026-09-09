import { nanoid } from "nanoid";
import {
  BENCH_SIZE,
  DIFFICULTY,
  GRADE_ORDER,
  PROJECTILE_SPEED,
  SELL_BASE_GOLD,
  SELL_REFUND_PCT,
  SPAWN_INTERVAL,
  TOTAL_WAVES,
  WAVES_PER_BOSS,
  WAVE_CLEAR_GOLD,
  WAVE_ENEMY_COUNT,
  WAVE_GOLD_GROWTH,
  WAVE_HP_GROWTH,
} from "./constants";
import { mitigate, primaryDamageType, rollCrit } from "./combat";
import { gachaCost, jobPassiveValue, rollGacha } from "./gacha";
import { canFuse, fuse } from "./fusion";
import { computeSynergies, synergyBonus } from "./synergy";
import type {
  ActiveSynergy,
  DamageType,
  Difficulty,
  EffectFx,
  EnemyDef,
  EnemyUnit,
  FloatingText,
  GachaDef,
  GamePhase,
  GlobalBuff,
  JobActiveSkill,
  JobBuffStat,
  JobDef,
  JobPassiveType,
  MapDef,
  Point,
  Projectile,
  Region,
  SkillDef,
  StageDef,
  SynergyDef,
  TowerDef,
  TowerUnit,
} from "./types";

export interface EngineOptions {
  map: MapDef;
  towers: TowerDef[];
  enemies: EnemyDef[];
  synergies: SynergyDef[];
  gachas: GachaDef[];
  job: JobDef | null;
  difficulty: Difficulty;
  /** 스테이지 (챕터/스테이지 시스템). 없으면 기본 웨이브 구성 */
  stage?: StageDef | null;
}

interface SpawnEntry {
  at: number; // 웨이브 시작 후 경과 시간(초)
  def: EnemyDef;
  hpMult: number;
  goldMult: number;
  pathId: number;
}

export interface GameLogEntry {
  text: string;
  color?: string;
}

/**
 * 로타디 게임 엔진 (순수 로직, DOM/Canvas 비의존)
 * - tick(dt)로 진행, UI는 상태를 읽기만 함
 * - React 동기화: version 카운터 (중요 상태 변경 시 증가)
 */
export class GameEngine {
  readonly map: MapDef;
  readonly towerDefs: Map<string, TowerDef>;
  readonly enemyDefs: Map<string, EnemyDef>;
  readonly synergyDefs: SynergyDef[];
  readonly gachaDefs: GachaDef[];
  readonly job: JobDef | null;
  readonly difficulty: Difficulty;
  readonly stage: StageDef | null;
  readonly towerPool: TowerDef[];

  // ---- 플레이어 상태 ----
  gold = 0;
  lives = 0;
  wave = 0; // 마지막으로 시작한 웨이브 번호
  phase: GamePhase = "prep";
  bench: TowerUnit[] = [];
  placed: TowerUnit[] = [];

  // ---- 직업 액티브 스킬 ----
  /** 스킬 인덱스(job.skills 기준) → 재사용 가능 시각 */
  jobSkillReadyAt = new Map<number, number>();
  /** 난이도에 따른 남은 직업 스킬 사용 횟수 (모든 액티브 스킬 공유) */
  jobSkillUsesLeft = 0;
  globalBuffs: GlobalBuff[] = [];

  // ---- 전투 상태 ----
  enemies: EnemyUnit[] = [];
  projectiles: Projectile[] = [];
  effects: EffectFx[] = [];
  floatingTexts: FloatingText[] = [];
  activeSynergies: ActiveSynergy[] = [];
  logs: GameLogEntry[] = [];

  time = 0;
  speed = 1;
  paused = false;

  /** React 리렌더 트리거용 */
  version = 0;

  private spawnQueue: SpawnEntry[] = [];
  private waveStartTime = 0;
  private waveSpawnDone = false;
  private spawnCounter = 0;

  constructor(opts: EngineOptions) {
    this.map = opts.map;
    this.towerDefs = new Map(opts.towers.map((t) => [t.id, t]));
    this.enemyDefs = new Map(opts.enemies.map((e) => [e.id, e]));
    this.synergyDefs = opts.synergies;
    this.gachaDefs = opts.gachas;
    this.job = opts.job;
    this.difficulty = opts.difficulty;
    this.stage = opts.stage ?? null;
    this.towerPool = opts.towers;

    const diff = DIFFICULTY[opts.difficulty];
    this.gold = diff.startGold;
    this.lives = diff.lives;
    this.jobSkillUsesLeft = diff.jobSkillUses;

    // 직업 패시브: 시작 골드 / 추가 목숨
    this.gold += this.jobBonus("start_gold");
    this.lives += this.jobBonus("extra_lives");

    this.log(
      `게임 시작! ${this.stage ? `[${this.stage.name}] ` : ""}난이도: ${diff.label}${this.job ? `, 직업: ${this.job.name}` : ""}`
    );
    this.bump();
  }

  get totalWaves(): number {
    return this.stage?.waves ?? TOTAL_WAVES;
  }

  private bump() {
    this.version++;
  }

  private log(text: string, color?: string) {
    this.logs.push({ text, color });
    if (this.logs.length > 60) this.logs.shift();
  }

  // ============================================================
  // 스탯 계산 (시너지: 전체 적용 + 직업 패시브 + 직업 액티브 버프)
  // ============================================================

  private jobBonus(type: JobPassiveType): number {
    return jobPassiveValue(this.job, type);
  }

  private globalBuffValue(stat: JobBuffStat): number {
    let total = 0;
    for (const b of this.globalBuffs) {
      if (b.stat === stat && b.until > this.time) total += b.value;
    }
    return total;
  }

  effectiveAtk(t: TowerUnit, def: TowerDef): number {
    const pct =
      synergyBonus(this.activeSynergies, "atk_pct") +
      this.jobBonus("atk_pct_all") +
      this.globalBuffValue("atk_pct");
    return def.atk * (1 + pct / 100);
  }

  effectiveMagicAtk(t: TowerUnit, def: TowerDef): number {
    const pct =
      synergyBonus(this.activeSynergies, "magic_atk_pct") +
      this.jobBonus("magic_atk_pct_all") +
      this.globalBuffValue("magic_atk_pct");
    return def.magicAtk * (1 + pct / 100);
  }

  effectiveAttackSpeed(t: TowerUnit, def: TowerDef): number {
    let pct =
      synergyBonus(this.activeSynergies, "atk_speed_pct") +
      this.jobBonus("atk_speed_pct_all") +
      this.globalBuffValue("atk_speed_pct");
    for (const b of t.buffs) {
      if (b.type === "atk_speed" && b.until > this.time) pct += b.pct;
    }
    return def.attackSpeed * (1 + pct / 100);
  }

  effectiveRange(t: TowerUnit, def: TowerDef): number {
    return def.range + synergyBonus(this.activeSynergies, "range_add");
  }

  effectiveCritChance(def: TowerDef): number {
    return (
      synergyBonus(this.activeSynergies, "crit_chance") +
      this.jobBonus("crit_chance_all") +
      this.globalBuffValue("crit_chance")
    );
  }

  effectiveCritDamage(def: TowerDef): number {
    return synergyBonus(this.activeSynergies, "crit_damage_pct");
  }

  effectiveManaRegen(def: TowerDef): number {
    const pct = synergyBonus(this.activeSynergies, "mana_regen_pct");
    return def.manaRegen * (1 + pct / 100);
  }

  private goldPerKillBonus(): number {
    return (
      synergyBonus(this.activeSynergies, "gold_per_kill") +
      this.jobBonus("gold_per_kill")
    );
  }

  private recomputeSynergies() {
    this.activeSynergies = computeSynergies(
      this.placed,
      this.towerDefs,
      this.synergyDefs,
      this.job
    );
  }

  // ============================================================
  // 직업 액티브 스킬
  // ============================================================

  /** 액티브 스킬 목록 (인덱스는 job.skills 기준) */
  activeJobSkills(): { index: number; skill: JobActiveSkill }[] {
    if (!this.job) return [];
    return this.job.skills
      .map((s, index) => ({ index, skill: s }))
      .filter((x): x is { index: number; skill: JobActiveSkill } => x.skill.kind === "active");
  }

  jobSkillCooldownLeft(index: number): number {
    const readyAt = this.jobSkillReadyAt.get(index) ?? 0;
    return Math.max(0, readyAt - this.time);
  }

  /**
   * 직업 액티브 스킬 시전.
   * - damage_area는 point(타일 좌표) 필요 — UI에서 캔버스 클릭으로 전달
   * - 난이도별 총 사용 횟수 제한 (jobSkillUsesLeft)
   */
  castJobSkill(index: number, point?: Point): boolean {
    if (!this.job) return false;
    const skill = this.job.skills[index];
    if (!skill || skill.kind !== "active") return false;
    if (this.jobSkillCooldownLeft(index) > 0) return false;
    if (this.jobSkillUsesLeft <= 0) {
      this.log("직업 스킬 사용 횟수를 모두 소진했습니다!", "#f87171");
      this.bump();
      return false;
    }

    const eff = skill.effect;
    switch (eff.type) {
      case "buff_all": {
        this.globalBuffs.push({
          stat: eff.stat,
          value: eff.value,
          until: this.time + eff.duration,
        });
        this.addFx("buff", this.mapCenter(), "#4ade80", 1.0, 1.2);
        this.log(`[직업 스킬] ${skill.name}! (${eff.duration}초)`, "#4ade80");
        break;
      }
      case "damage_area": {
        if (!point) return false;
        this.addFx("aoe", point, "#f97316", 0.6, eff.radius);
        this.addFx("skill_text", { x: point.x, y: point.y - 0.6 }, "#f97316", 1.0, 0, skill.name);
        for (const e of this.nearbyEnemies(point, eff.radius)) {
          this.dealDamage(e, eff.damage, eff.damageType, false, "job-skill");
        }
        this.log(`[직업 스킬] ${skill.name}!`, "#f97316");
        break;
      }
      case "gold_grant": {
        this.gold += eff.value;
        this.log(`[직업 스킬] ${skill.name}! +${eff.value}G`, "#fbbf24");
        break;
      }
    }

    this.jobSkillReadyAt.set(index, this.time + skill.cooldown);
    this.jobSkillUsesLeft--;
    if (this.jobSkillUsesLeft === 0) {
      this.log("⚠ 직업 스킬 사용 횟수를 모두 사용했습니다.", "#fbbf24");
    }
    this.bump();
    return true;
  }

  private mapCenter(): Point {
    return { x: this.map.cols / 2, y: this.map.rows / 2 };
  }

  // ============================================================
  // 뽑기 / 합성 / 배치 / 이동 / 판매
  // ============================================================

  findGacha(gachaId: string): GachaDef | undefined {
    return this.gachaDefs.find((g) => g.id === gachaId);
  }

  canAffordGacha(gachaId: string): boolean {
    const gacha = this.findGacha(gachaId);
    return !!gacha && this.gold >= gachaCost(gacha, this.job);
  }

  buyGacha(gachaId: string, region?: Region): TowerDef | null {
    const gacha = this.findGacha(gachaId);
    if (!gacha) return null;
    if (this.bench.length >= BENCH_SIZE) {
      this.log("대기석이 가득 찼습니다!", "#f87171");
      this.bump();
      return null;
    }
    const cost = gachaCost(gacha, this.job);
    if (this.gold < cost) return null;

    const def = rollGacha(this.towerPool, gacha, region);
    if (!def) {
      this.log("해당 조건의 캐릭터가 없습니다.", "#f87171");
      this.bump();
      return null;
    }

    this.gold -= cost;
    this.bench.push(this.createTowerUnit(def.id));
    this.log(`[뽑기] ${def.name} 획득!`, def.grade === "esther" ? "#22d3ee" : undefined);
    if (def.grade === "esther") this.log("★★★ 에스더 등급! ★★★", "#22d3ee");
    this.bump();
    return def;
  }

  private createTowerUnit(defId: string): TowerUnit {
    return {
      uid: nanoid(8),
      defId,
      tile: null,
      mana: 0,
      nextAttackAt: 0,
      kills: 0,
      totalDamage: 0,
      buffs: [],
      attackAnim: 0,
      aimAngle: 0,
    };
  }

  findUnit(uid: string): TowerUnit | undefined {
    return (
      this.bench.find((t) => t.uid === uid) ?? this.placed.find((t) => t.uid === uid)
    );
  }

  /** 특정 유닛과 합성 가능한 다른 유닛 uid 목록 (선택 기반 합성 UI용) */
  fusionCandidates(uid: string): string[] {
    const unit = this.findUnit(uid);
    if (!unit) return [];
    const all = [...this.bench, ...this.placed];
    return all
      .filter((other) => other.uid !== uid && this.canFuseUnits(uid, other.uid))
      .map((o) => o.uid);
  }

  canFuseUnits(uidA: string, uidB: string): boolean {
    if (uidA === uidB) return false;
    const a = this.findUnit(uidA);
    const b = this.findUnit(uidB);
    if (!a || !b) return false;
    const da = this.towerDefs.get(a.defId);
    const db = this.towerDefs.get(b.defId);
    if (!da || !db) return false;
    return canFuse(da, db);
  }

  /** 같은 등급 2개 합성 → 상위 등급 (대기석/배치 어디든 가능, 결과는 대기석) */
  fuseUnits(uidA: string, uidB: string): TowerDef | null {
    if (!this.canFuseUnits(uidA, uidB)) return null;
    const a = this.findUnit(uidA)!;
    const b = this.findUnit(uidB)!;
    const da = this.towerDefs.get(a.defId)!;
    const db = this.towerDefs.get(b.defId)!;

    const outcome = fuse(da, db, this.towerPool, this.job);
    if (!outcome) return null;

    this.removeUnit(uidA);
    this.removeUnit(uidB);
    this.bench.push(this.createTowerUnit(outcome.def.id));

    if (outcome.jackpot) {
      this.log(`[합성 대성공!] 2단계 상위 ${outcome.def.name} 획득!!`, "#fbbf24");
    } else {
      this.log(`[합성] ${outcome.def.name} 획득!`);
    }
    this.recomputeSynergies();
    this.bump();
    return outcome.def;
  }

  private removeUnit(uid: string) {
    this.bench = this.bench.filter((t) => t.uid !== uid);
    this.placed = this.placed.filter((t) => t.uid !== uid);
  }

  isTileBuildable(x: number, y: number): boolean {
    if (y < 0 || y >= this.map.rows || x < 0 || x >= this.map.cols) return false;
    if (this.map.tiles[y][x] !== "buildable") return false;
    return !this.placed.some((t) => t.tile && t.tile.x === x && t.tile.y === y);
  }

  /** 대기석 유닛을 타일에 배치 */
  placeTower(uid: string, x: number, y: number): boolean {
    const unit = this.bench.find((t) => t.uid === uid);
    if (!unit || !this.isTileBuildable(x, y)) return false;
    this.bench = this.bench.filter((t) => t.uid !== uid);
    unit.tile = { x, y };
    this.placed.push(unit);
    this.recomputeSynergies();
    this.bump();
    return true;
  }

  /** 배치된 타워를 다른 건설 가능 타일로 이동 (드래그 앤 드랍) */
  moveTower(uid: string, x: number, y: number): boolean {
    const unit = this.placed.find((t) => t.uid === uid);
    if (!unit || !unit.tile) return false;
    if (unit.tile.x === x && unit.tile.y === y) return false;
    if (!this.isTileBuildable(x, y)) return false;
    unit.tile = { x, y };
    this.bump();
    return true;
  }

  /** 배치 유닛을 대기석으로 회수 */
  unplaceTower(uid: string): boolean {
    const unit = this.placed.find((t) => t.uid === uid);
    if (!unit || this.bench.length >= BENCH_SIZE) return false;
    this.placed = this.placed.filter((t) => t.uid !== uid);
    unit.tile = null;
    unit.buffs = [];
    this.bench.push(unit);
    this.recomputeSynergies();
    this.bump();
    return true;
  }

  /** 판매: 기준 골드 x 등급 배수 x 환급률 */
  sellTower(uid: string): boolean {
    const unit = this.findUnit(uid);
    if (!unit) return false;
    const def = this.towerDefs.get(unit.defId);
    if (!def) return false;
    const gradeIdx = GRADE_ORDER.indexOf(def.grade);
    const refund = Math.round(
      (SELL_BASE_GOLD * Math.pow(2, gradeIdx) * SELL_REFUND_PCT) / 100
    );
    this.removeUnit(uid);
    this.gold += refund;
    this.log(`[판매] ${def.name} → ${refund}G`);
    this.recomputeSynergies();
    this.bump();
    return true;
  }

  // ============================================================
  // 웨이브 (스테이지 구성 반영)
  // ============================================================

  canStartWave(): boolean {
    return this.phase === "prep" && this.wave < this.totalWaves;
  }

  startWave() {
    if (!this.canStartWave()) return;
    this.wave++;
    this.phase = "wave";
    this.waveStartTime = this.time;
    this.waveSpawnDone = false;
    this.spawnQueue = this.buildWave(this.wave);
    this.log(`━━ 웨이브 ${this.wave} 시작! ━━`, this.isBossWave(this.wave) ? "#f87171" : undefined);
    if (this.isBossWave(this.wave)) this.log("⚠ 보스 웨이브!", "#f87171");
    this.bump();
  }

  isBossWave(wave: number): boolean {
    // 마지막 웨이브 또는 5의 배수 웨이브는 보스
    return wave % WAVES_PER_BOSS === 0 || wave === this.totalWaves;
  }

  /** 스테이지에 지정된 적 풀 (없으면 전체) */
  private stageNormalPool(): EnemyDef[] {
    const all = Array.from(this.enemyDefs.values()).filter((e) => !e.isBoss);
    if (!this.stage || this.stage.enemyIds.length === 0) return all;
    const picked = this.stage.enemyIds
      .map((id) => this.enemyDefs.get(id))
      .filter((e): e is EnemyDef => !!e && !e.isBoss);
    return picked.length > 0 ? picked : all;
  }

  private stageBossPool(): EnemyDef[] {
    const all = Array.from(this.enemyDefs.values()).filter((e) => e.isBoss);
    if (this.stage?.bossId) {
      const boss = this.enemyDefs.get(this.stage.bossId);
      if (boss) return [boss];
    }
    return all;
  }

  /**
   * 가장 가까운 보스 정보 (UI 표시용)
   * - 현재 보스가 살아있으면 그 보스 (실시간 체력 포함)
   * - 아니면 다음 보스 웨이브의 보스 + 예상 체력
   */
  bossPreview(): {
    wave: number;
    def: EnemyDef;
    maxHp: number;
    alive: EnemyUnit | null;
  } | null {
    const alive = this.enemies.find((e) => e.isBoss && !e.dead && !e.reached);
    if (alive) {
      const def = this.enemyDefs.get(alive.defId);
      if (def) return { wave: this.wave, def, maxHp: alive.maxHp, alive };
    }
    const bosses = this.stageBossPool();
    if (bosses.length === 0) return null;
    for (let w = this.wave + 1; w <= this.totalWaves; w++) {
      if (!this.isBossWave(w)) continue;
      const def = bosses[Math.floor(w / WAVES_PER_BOSS) % bosses.length];
      const diff = DIFFICULTY[this.difficulty];
      const hpMult =
        Math.pow(WAVE_HP_GROWTH, w - 1) *
        diff.enemyHpMult *
        (this.stage?.hpMult ?? 1) *
        6; // 보스 체력 배수 (buildWave와 동일)
      return { wave: w, def, maxHp: Math.round(def.hp * hpMult), alive: null };
    }
    return null;
  }

  private buildWave(wave: number): SpawnEntry[] {
    const diff = DIFFICULTY[this.difficulty];
    const stageHp = this.stage?.hpMult ?? 1;
    const stageGold = this.stage?.goldMult ?? 1;
    const hpMult = Math.pow(WAVE_HP_GROWTH, wave - 1) * diff.enemyHpMult * stageHp;
    const goldMult = Math.pow(WAVE_GOLD_GROWTH, wave - 1) * stageGold;

    const normals = this.stageNormalPool();
    const bosses = this.stageBossPool();
    const pathCount = Math.max(1, this.map.paths.length);

    const entries: SpawnEntry[] = [];
    if (this.isBossWave(wave) && bosses.length > 0) {
      const boss = bosses[Math.floor(wave / WAVES_PER_BOSS) % bosses.length];
      entries.push({
        at: 0.5,
        def: boss,
        hpMult: hpMult * 6,
        goldMult: goldMult * 5,
        pathId: this.spawnCounter++ % pathCount,
      });
    } else if (normals.length > 0) {
      for (let i = 0; i < WAVE_ENEMY_COUNT; i++) {
        const def = normals[(wave + i) % normals.length];
        entries.push({
          at: i * SPAWN_INTERVAL,
          def,
          hpMult,
          goldMult,
          pathId: this.spawnCounter++ % pathCount,
        });
      }
    }
    return entries;
  }

  private spawnEnemy(entry: SpawnEntry) {
    const diff = DIFFICULTY[this.difficulty];
    const path = this.map.paths[entry.pathId] ?? this.map.paths[0];
    const start = path?.[0];
    if (!start) return;
    const hp = Math.round(entry.def.hp * entry.hpMult);
    const unit: EnemyUnit = {
      uid: nanoid(8),
      defId: entry.def.id,
      hp,
      maxHp: hp,
      defense: Math.round(entry.def.defense * diff.enemyDefMult),
      magicDefense: Math.round(entry.def.magicDefense * diff.enemyDefMult),
      moveSpeed: entry.def.moveSpeed,
      isBoss: entry.def.isBoss,
      goldReward: Math.max(1, Math.round(entry.def.goldReward * entry.goldMult)),
      pos: { x: start.x, y: start.y },
      pathId: entry.pathId,
      pathIndex: 1,
      slowPct: 0,
      slowUntil: 0,
      stunUntil: 0,
      hitFlashUntil: 0,
      dead: false,
      reached: false,
    };
    this.enemies.push(unit);
  }

  // ============================================================
  // 메인 루프
  // ============================================================

  tick(rawDt: number) {
    if (this.paused || this.phase === "victory" || this.phase === "defeat") return;
    const dt = Math.min(rawDt, 0.1) * this.speed;
    this.time += dt;

    if (this.phase === "wave") {
      // 스폰
      const elapsed = this.time - this.waveStartTime;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= elapsed) {
        this.spawnEnemy(this.spawnQueue.shift()!);
      }
      if (this.spawnQueue.length === 0) this.waveSpawnDone = true;
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);

    // 만료된 전역 버프 정리
    this.globalBuffs = this.globalBuffs.filter((b) => b.until > this.time);

    // 웨이브 종료 판정
    if (this.phase === "wave" && this.waveSpawnDone && this.enemies.length === 0) {
      this.gold += WAVE_CLEAR_GOLD;
      this.log(`웨이브 ${this.wave} 클리어! +${WAVE_CLEAR_GOLD}G`, "#4ade80");
      if (this.wave >= this.totalWaves) {
        this.phase = "victory";
        this.log("🎉 모든 웨이브 방어 성공! 승리!", "#fbbf24");
      } else {
        this.phase = "prep";
      }
      this.bump();
    }
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.dead || e.reached) continue;
      if (e.stunUntil > this.time) continue;

      const path = this.map.paths[e.pathId] ?? this.map.paths[0] ?? [];

      let speed = e.moveSpeed;
      if (e.slowUntil > this.time) speed *= 1 - e.slowPct / 100;

      let remaining = speed * dt;
      while (remaining > 0 && e.pathIndex < path.length) {
        const target = path[e.pathIndex];
        const dx = target.x - e.pos.x;
        const dy = target.y - e.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= remaining) {
          e.pos = { x: target.x, y: target.y };
          e.pathIndex++;
          remaining -= dist;
        } else {
          e.pos = {
            x: e.pos.x + (dx / dist) * remaining,
            y: e.pos.y + (dy / dist) * remaining,
          };
          remaining = 0;
        }
      }

      // 도착지 도달
      if (e.pathIndex >= path.length) {
        e.reached = true;
        this.lives--;
        this.log(`적이 도착지에 도달! 목숨 -1 (남은 목숨 ${Math.max(0, this.lives)})`, "#f87171");
        this.addFx("death", e.pos, "#f87171", 0.5, 0.8);
        if (this.lives <= 0) {
          this.phase = "defeat";
          this.log("💀 게임 오버...", "#f87171");
        }
        this.bump();
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead && !e.reached);
  }

  private updateTowers(dt: number) {
    for (const t of this.placed) {
      if (!t.tile) continue;
      const def = this.towerDefs.get(t.defId);
      if (!def) continue;

      // 마나 자연 회복 (전투 중에만)
      if (this.phase === "wave") {
        t.mana = Math.min(def.maxMana, t.mana + this.effectiveManaRegen(def) * dt);
      }
      // 버프 정리
      t.buffs = t.buffs.filter((b) => b.until > this.time);
      // 공격 모션 감쇠
      t.attackAnim = Math.max(0, t.attackAnim - dt * 4);

      if (this.enemies.length === 0) continue;
      if (this.time < t.nextAttackAt) continue;

      const range = this.effectiveRange(t, def);
      const target = this.pickTarget(t.tile, range);
      if (!target) continue;

      // 스킬 사용 (마나 가득)
      if (def.maxMana > 0 && t.mana >= def.maxMana) {
        t.mana = 0;
        this.castSkill(t, def, target);
      } else {
        this.fireProjectile(t, def, target, false);
      }

      const atkSpeed = this.effectiveAttackSpeed(t, def);
      t.nextAttackAt = this.time + 1 / Math.max(0.05, atkSpeed);
      t.attackAnim = 1;
      t.aimAngle = Math.atan2(target.pos.y - t.tile.y, target.pos.x - t.tile.x);
    }
  }

  /** 타겟: 사거리 내에서 도착지에 가장 가까운 적 */
  private pickTarget(from: Point, range: number): EnemyUnit | null {
    let best: EnemyUnit | null = null;
    let bestProgress = -1;
    for (const e of this.enemies) {
      if (e.dead || e.reached) continue;
      const d = Math.hypot(e.pos.x - from.x, e.pos.y - from.y);
      if (d > range) continue;
      const progress = e.pathIndex * 1000 - this.distToNextWaypoint(e);
      if (progress > bestProgress) {
        bestProgress = progress;
        best = e;
      }
    }
    return best;
  }

  private distToNextWaypoint(e: EnemyUnit): number {
    const path = this.map.paths[e.pathId] ?? [];
    const wp = path[Math.min(e.pathIndex, path.length - 1)];
    if (!wp) return 0;
    return Math.hypot(wp.x - e.pos.x, wp.y - e.pos.y);
  }

  private fireProjectile(
    t: TowerUnit,
    def: TowerDef,
    target: EnemyUnit,
    fromSkill: boolean,
    overrideDamage?: number,
    overrideType?: DamageType
  ) {
    const type = overrideType ?? primaryDamageType(def.atk, def.magicAtk);
    const baseDamage =
      overrideDamage ??
      (type === "physical"
        ? this.effectiveAtk(t, def)
        : this.effectiveMagicAtk(t, def));

    const { damage, crit } = rollCrit(
      baseDamage,
      this.effectiveCritChance(def),
      this.effectiveCritDamage(def)
    );

    this.projectiles.push({
      uid: nanoid(8),
      pos: { x: t.tile!.x, y: t.tile!.y },
      targetUid: target.uid,
      speed: PROJECTILE_SPEED,
      damage,
      damageType: type,
      crit,
      color: fromSkill ? "#fbbf24" : def.appearance.color,
      sourceUid: t.uid,
      fromSkill,
    });
  }

  private updateProjectiles(dt: number) {
    const next: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.uid === p.targetUid);
      if (!target || target.dead || target.reached) continue; // 대상 소멸 → 투사체 제거

      const dx = target.pos.x - p.pos.x;
      const dy = target.pos.y - p.pos.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;

      if (dist <= step + 0.15) {
        this.onProjectileHit(p, target);
      } else {
        p.pos = { x: p.pos.x + (dx / dist) * step, y: p.pos.y + (dy / dist) * step };
        next.push(p);
      }
    }
    this.projectiles = next;
  }

  private onProjectileHit(p: Projectile, target: EnemyUnit) {
    this.dealDamage(target, p.damage, p.damageType, p.crit, p.sourceUid);
    this.addFx(p.crit ? "crit" : "hit", target.pos, p.color, p.crit ? 0.4 : 0.25, p.crit ? 0.5 : 0.3);

    // 적 타격 시 마나 획득
    const src = this.placed.find((t) => t.uid === p.sourceUid);
    if (src) {
      const def = this.towerDefs.get(src.defId);
      if (def) src.mana = Math.min(def.maxMana, src.mana + def.manaOnHit);
    }
  }

  private dealDamage(
    target: EnemyUnit,
    rawDamage: number,
    type: DamageType,
    crit: boolean,
    sourceUid: string
  ) {
    const defense = type === "physical" ? target.defense : target.magicDefense;
    const final = Math.max(1, Math.round(mitigate(rawDamage, defense, type)));
    target.hp -= final;
    target.hitFlashUntil = this.time + 0.12;

    this.floatingTexts.push({
      uid: nanoid(6),
      pos: { x: target.pos.x, y: target.pos.y - 0.3 },
      text: String(final),
      color: crit ? "#fbbf24" : type === "physical" ? "#f8fafc" : "#c084fc",
      t: 0,
      duration: crit ? 0.9 : 0.6,
      crit,
    });

    const src = this.placed.find((t) => t.uid === sourceUid);
    if (src) src.totalDamage += final;

    if (target.hp <= 0 && !target.dead) {
      target.dead = true;
      const bonus = this.goldPerKillBonus();
      const reward = target.goldReward + bonus;
      this.gold += reward;
      if (src) src.kills++;
      this.addFx("death", target.pos, "#fca5a5", 0.6, 0.6);
      if (target.isBoss) this.log(`보스 처치! +${reward}G`, "#fbbf24");
      this.bump();
    }
  }

  // ============================================================
  // 타워 스킬
  // ============================================================

  private castSkill(t: TowerUnit, def: TowerDef, target: EnemyUnit) {
    const skill: SkillDef = def.skill;
    const type = skill.damageType;
    const base =
      type === "physical" ? this.effectiveAtk(t, def) : this.effectiveMagicAtk(t, def);
    const power = base * (skill.power / 100);

    this.addFx("skill_text", { x: t.tile!.x, y: t.tile!.y - 0.5 }, "#fbbf24", 1.0, 0, skill.name);

    switch (skill.type) {
      case "nuke": {
        this.fireProjectile(t, def, target, true, power, type);
        break;
      }
      case "aoe": {
        const radius = skill.radius ?? 1.5;
        this.addFx("aoe", target.pos, "#fb923c", 0.5, radius);
        for (const e of this.nearbyEnemies(target.pos, radius)) {
          const { damage, crit } = rollCrit(
            power,
            this.effectiveCritChance(def),
            this.effectiveCritDamage(def)
          );
          this.dealDamage(e, damage, type, crit, t.uid);
        }
        break;
      }
      case "slow": {
        const radius = skill.radius ?? 1.5;
        const dur = skill.duration ?? 2;
        const slowPct = skill.slowPct ?? 30;
        this.addFx("slow", target.pos, "#38bdf8", dur, radius);
        for (const e of this.nearbyEnemies(target.pos, radius)) {
          this.dealDamage(e, power, type, false, t.uid);
          e.slowPct = Math.max(e.slowPct, slowPct);
          e.slowUntil = Math.max(e.slowUntil, this.time + dur);
        }
        break;
      }
      case "stun": {
        const dur = skill.duration ?? 1;
        this.dealDamage(target, power, type, false, t.uid);
        target.stunUntil = Math.max(target.stunUntil, this.time + dur);
        this.addFx("stun", target.pos, "#fde047", dur, 0.5);
        break;
      }
      case "chain": {
        const extra = skill.bonusTargets ?? 2;
        const targets: EnemyUnit[] = [target];
        for (const e of this.enemies) {
          if (targets.length > extra) break;
          if (e.dead || e.reached || targets.includes(e)) continue;
          if (Math.hypot(e.pos.x - target.pos.x, e.pos.y - target.pos.y) <= 2.5) {
            targets.push(e);
          }
        }
        for (const e of targets) {
          this.fireProjectile(t, def, e, true, power, type);
        }
        break;
      }
      case "buff_atkspeed": {
        const dur = skill.duration ?? 3;
        const pct = skill.buffPct ?? 50;
        t.buffs.push({ type: "atk_speed", pct, until: this.time + dur });
        this.addFx("buff", { x: t.tile!.x, y: t.tile!.y }, "#4ade80", dur, 0.6);
        // 버프형도 일반 공격은 수행
        this.fireProjectile(t, def, target, false);
        break;
      }
    }
  }

  private nearbyEnemies(center: Point, radius: number): EnemyUnit[] {
    return this.enemies.filter(
      (e) =>
        !e.dead &&
        !e.reached &&
        Math.hypot(e.pos.x - center.x, e.pos.y - center.y) <= radius
    );
  }

  // ============================================================
  // 이펙트
  // ============================================================

  private addFx(
    kind: EffectFx["kind"],
    pos: Point,
    color: string,
    duration: number,
    radius?: number,
    text?: string
  ) {
    this.effects.push({
      uid: nanoid(6),
      kind,
      pos: { ...pos },
      t: 0,
      duration,
      radius,
      color,
      text,
    });
  }

  private updateFx(dt: number) {
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.duration);
    for (const ft of this.floatingTexts) ft.t += dt;
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.t < ft.duration);
  }
}
