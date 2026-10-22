// ============================================================
// 로타디 (로스트아크 랜덤 타워 디펜스) - 도메인 타입 정의
// UI(View)와 완전히 분리된 순수 데이터 모델
// ============================================================

/** 캐릭터 등급 (캐릭터마다 고정) */
export type Grade =
  | "common" // 일반
  | "uncommon" // 고급
  | "rare" // 희귀
  | "hero" // 영웅
  | "legendary"; // 전설 (에스더 포함)

/** 지역(시너지) - 데이터 주도. 예: 슈샤이어, 애니츠, 아르데타인 ... */
export type Region = string;

export type DamageType = "physical" | "magical";

export type Difficulty = "easy" | "hard" | "nightmare";

/** 스프라이트 시트 애니메이션 1개: 시트의 row번째 줄에서 frames개 프레임 */
export interface SpriteAnim {
  row: number;
  frames: number;
  fps: number;
}

/**
 * 스프라이트 시트 정의
 * - 가로로 프레임이 나열되고, 줄(row)마다 애니메이션이 다른 형식
 * - idle은 필수, 나머지는 없으면 idle로 대체
 */
export interface SpriteSheet {
  src: string; // /characters/xxx.png
  frameWidth: number;
  frameHeight: number;
  animations: {
    idle: SpriteAnim;
    attack?: SpriteAnim;
    skill?: SpriteAnim;
    walk?: SpriteAnim;
    death?: SpriteAnim;
  };
  /** 렌더 배율 (1 = 타일 크기의 약 80%) */
  scale?: number;
  /** 시트의 기본 바라보는 방향 (반전 계산용) */
  facing?: "left" | "right";
}

/** 외형. 우선순위: sprite > image > 도형 placeholder */
export interface Appearance {
  color: string; // 주 색상 (hex)
  shape: "circle" | "square" | "triangle" | "diamond" | "star";
  icon: string; // 이모지 placeholder
  image?: string; // 단일 정지 이미지 /characters/xxx.png
  sprite?: SpriteSheet; // 애니메이션 스프라이트 시트
  /** 조준/이동 방향에 따라 좌우 반전 (기본 true) */
  flipToFace?: boolean;
}

// ------------------------------------------------------------
// 스킬 (타워)
// ------------------------------------------------------------

export type SkillType =
  | "nuke" // 단일 강타
  | "aoe" // 범위 피해
  | "slow" // 범위 둔화 + 피해
  | "stun" // 대상 기절 + 피해
  | "chain" // 연쇄 공격 (추가 대상)
  | "buff_atkspeed"; // 자기 공격속도 버프

export interface SkillDef {
  name: string;
  type: SkillType;
  damageType: DamageType;
  /** 스킬 계수: 해당 데미지 타입 공격력의 % (150 = 150%) */
  power: number;
  /** aoe/slow: 반경(타일) */
  radius?: number;
  /** slow/stun/buff: 지속시간(초) */
  duration?: number;
  /** slow: 둔화율 % (30 = 30% 감속) */
  slowPct?: number;
  /** chain: 추가 대상 수 */
  bonusTargets?: number;
  /** buff_atkspeed: 공격속도 증가 % */
  buffPct?: number;
  description?: string;
}

// ------------------------------------------------------------
// 아군 캐릭터(타워)
// ------------------------------------------------------------

export interface TowerDef {
  id: string;
  name: string;
  grade: Grade;
  /** 보유 시너지 지역 (여러 개 가능) */
  regions: Region[];
  atk: number; // 물리 공격력
  magicAtk: number; // 마법 공격력
  attackSpeed: number; // 초당 공격 횟수
  range: number; // 사거리 (타일)
  maxMana: number;
  manaRegen: number; // 초당 자연 회복 마나
  manaOnHit: number; // 적 타격 시 획득 마나
  skill: SkillDef;
  appearance: Appearance;
  description?: string;
  /** 이미지 생성용 캐릭터 외형 디스크립터 (docs/character-references.md 참고) */
  artRef?: string;
}

// ------------------------------------------------------------
// 적 캐릭터
// ------------------------------------------------------------

/** 적 특성 */
export type EnemyTrait =
  | { type: "regen"; pctPerSec: number } // 초당 최대체력 % 회복
  | { type: "stealth"; revealRange: number } // 이 거리 이내 타워만 타겟 가능
  | { type: "split"; enemyId: string; count: number } // 사망 시 분열
  | { type: "aura_defense"; radius: number; defense: number; magicDefense: number } // 주변 적 방어 증가
  | { type: "slow_immune" }
  | { type: "stun_immune" };

export type EnemyTraitType = EnemyTrait["type"];

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  defense: number; // 방어력 (물리 피해 감소)
  magicDefense: number; // 마법 방어력
  moveSpeed: number; // 초당 이동 타일 수
  isBoss: boolean;
  goldReward: number; // 처치 골드
  traits?: EnemyTrait[];
  appearance: Appearance;
  description?: string;
  /** 이미지 생성용 캐릭터 외형 디스크립터 */
  artRef?: string;
}

// ------------------------------------------------------------
// 시너지
// ------------------------------------------------------------

export type SynergyEffectType =
  | "atk_pct" // 공격력 %
  | "magic_atk_pct" // 마법 공격력 %
  | "atk_speed_pct" // 공격속도 %
  | "crit_chance" // 치명타 확률 +%p
  | "crit_damage_pct" // 치명타 피해 +%p
  | "mana_regen_pct" // 마나 회복 %
  | "range_add" // 사거리 +타일
  | "gold_per_kill"; // 처치당 추가 골드

export interface SynergyEffect {
  type: SynergyEffectType;
  value: number;
}

export interface SynergyTier {
  /** 발동에 필요한 (서로 다른) 캐릭터 수 */
  count: number;
  effects: SynergyEffect[];
}

export interface SynergyDef {
  id: string;
  region: Region;
  name: string;
  color?: string;
  tiers: SynergyTier[];
  description?: string;
}

// ------------------------------------------------------------
// 플레이어 직업 (패시브 / 액티브 스킬)
// ------------------------------------------------------------

export type JobPassiveType =
  | "start_gold" // 시작 골드 +value
  | "extra_lives" // 목숨 +value
  | "gacha_discount_pct" // 뽑기 비용 할인 %
  | "crit_chance_all" // 전체 타워 치명타 확률 +%p
  | "atk_pct_all" // 전체 물리 공격력 %
  | "magic_atk_pct_all" // 전체 마법 공격력 %
  | "atk_speed_pct_all" // 전체 공격속도 %
  | "crit_damage_pct_all" // 전체 치명타 피해 +%p
  | "mana_regen_pct_all" // 전체 마나 회복 %
  | "gold_per_kill" // 처치당 추가 골드
  | "fusion_jackpot_pct"; // 합성 2단계 상위 확률 +%p

export interface JobPassiveSkill {
  kind: "passive";
  name: string;
  type: JobPassiveType;
  value: number;
  description?: string;
}

/** 액티브 스킬 대상 스탯 (전체 아군 일시 버프) */
export type JobBuffStat =
  | "atk_pct"
  | "magic_atk_pct"
  | "atk_speed_pct"
  | "crit_chance"
  | "crit_damage_pct";

export type JobActiveEffect =
  | {
      /** 일정 시간 아군 전체 강화 */
      type: "buff_all";
      stat: JobBuffStat;
      value: number;
      duration: number; // 초
    }
  | {
      /** 클릭 지점 범위 적에게 피해 */
      type: "damage_area";
      damage: number;
      damageType: DamageType;
      radius: number; // 타일
    }
  | {
      /** 즉시 골드 획득 */
      type: "gold_grant";
      value: number;
    };

export interface JobActiveSkill {
  kind: "active";
  name: string;
  cooldown: number; // 초
  effect: JobActiveEffect;
  description?: string;
}

export type JobSkill = JobPassiveSkill | JobActiveSkill;

export interface JobDef {
  id: string;
  name: string;
  /** 직업군 (홈 화면 직업 목록을 이 이름으로 묶어 접기/펼치기) 예: 전사, 무도가 */
  group?: string;
  /** 이 지역 시너지 캐릭터 수 +1 (TFT 상징 아이템 개념) */
  synergyRegion?: Region;
  skills: JobSkill[];
  appearance?: Appearance;
  description?: string;
}

// ------------------------------------------------------------
// 웨이브 미션 - CRUD 가능, 웨이브 시작 시 1개 부여 / 적 전멸 시 판정
// ------------------------------------------------------------

export type MissionCondition =
  | { type: "no_leak" } // 목숨 손실 없이 클리어
  | { type: "clear_within"; seconds: number } // 웨이브 시작 후 N초 이내 클리어
  | { type: "no_job_skill" } // 직업 액티브 스킬 사용 없이 클리어
  | { type: "max_placed"; count: number } // 배치 타워 N개 이하로 클리어
  | { type: "boss_within"; seconds: number }; // 웨이브 시작 후 N초 이내 보스 처치 (보스 웨이브 전용)

export type MissionConditionType = MissionCondition["type"];

/** 미션 등장 웨이브: any=모든 웨이브, normal=일반 웨이브만, boss=보스 웨이브만 */
export type MissionWaveFilter = "any" | "normal" | "boss";

export interface MissionDef {
  id: string;
  name: string;
  condition: MissionCondition;
  /** 성공 보상 골드 */
  rewardGold: number;
  waveFilter: MissionWaveFilter;
  /** 이 웨이브 이상부터 등장 */
  minWave?: number;
  description?: string;
}

// ------------------------------------------------------------
// 뽑기 (가챠) - 종류/확률 CRUD 가능
// ------------------------------------------------------------

/** 지역 조건: any=전체, select=플레이어가 지역 선택, fixed=특정 지역 고정 */
export type GachaRegionMode = "any" | "select" | "fixed";

export interface GachaDef {
  id: string;
  name: string;
  cost: number;
  /** 등급별 가중치(확률). 미지정/0 = 해당 등급 등장 안함. 합계 기준 자동 정규화 */
  rates: Partial<Record<Grade, number>>;
  regionMode: GachaRegionMode;
  /** regionMode가 "fixed"일 때 대상 지역 */
  fixedRegion?: Region;
  description?: string;
}

// ------------------------------------------------------------
// 맵 (경로 최대 3개)
// ------------------------------------------------------------

export type TileType = "empty" | "buildable" | "path" | "blocked";

export interface Point {
  x: number;
  y: number;
}

export interface MapDef {
  id: string;
  name: string;
  /** 맵 테마 지역 (선택) */
  region?: Region;
  cols: number;
  rows: number;
  /** tiles[row][col] */
  tiles: TileType[][];
  /**
   * 적 이동 경로 목록 (최대 3개).
   * 각 경로는 웨이포인트 순서 배열: 첫 번째=출발지, 마지막=도착지
   */
  paths: Point[][];
  description?: string;
}

// ------------------------------------------------------------
// 레벨 디자인: 챕터 / 스테이지
// ------------------------------------------------------------

/** 수동 웨이브 구성의 스폰 그룹 */
export interface WaveGroup {
  enemyId: string;
  count: number;
  /** 스폰 간격(초) */
  interval: number;
  /** 이 그룹 시작 전 대기(초) */
  delay?: number;
}

/** 수동 웨이브 1개 정의 */
export interface WaveDef {
  groups: WaveGroup[];
  /** 지정 시 이 웨이브는 보스 웨이브 (보스 1기 추가 스폰) */
  bossId?: string;
  /** 이 웨이브 전용 배수 (스테이지 배수에 곱해짐) */
  hpMult?: number;
  goldMult?: number;
  /** 지정 시 이 웨이브의 미션 고정 (없으면 미션 풀에서 자동 배정) */
  missionId?: string;
  description?: string;
}

export interface StageDef {
  id: string;
  name: string;
  /** 총 웨이브 수 (자동 생성 모드에서 사용; 수동 웨이브가 있으면 그 개수) */
  waves: number;
  /** 자동 생성 모드: 등장하는 일반 적 id 목록 */
  enemyIds: string[];
  /** 자동 생성 모드: 보스 웨이브 보스 id (없으면 전체 보스 풀에서) */
  bossId?: string;
  /** 스테이지 체력/골드 배수 */
  hpMult: number;
  goldMult: number;
  /**
   * 수동 웨이브 구성 (있으면 자동 생성 대신 사용).
   * 웨이브 n = waveDefs[n-1]
   */
  waveDefs?: WaveDef[];
  description?: string;
}

export interface ChapterDef {
  id: string;
  name: string;
  /** 챕터 테마 지역 */
  region?: Region;
  /** 이 챕터에서 사용하는 맵 */
  mapId: string;
  stages: StageDef[];
  description?: string;
}

// ------------------------------------------------------------
// 게임 데이터 번들 (CRUD 대상 전체)
// ------------------------------------------------------------

export interface GameData {
  maps: MapDef[];
  jobs: JobDef[];
  towers: TowerDef[];
  enemies: EnemyDef[];
  synergies: SynergyDef[];
  gachas: GachaDef[];
  chapters: ChapterDef[];
  missions: MissionDef[];
}

export type EntityKind = keyof GameData;

// ------------------------------------------------------------
// 런타임(전투 중) 상태 - 엔진 내부에서 사용
// ------------------------------------------------------------

export interface EnemyUnit {
  uid: string;
  defId: string;
  hp: number;
  maxHp: number;
  defense: number;
  magicDefense: number;
  moveSpeed: number;
  isBoss: boolean;
  goldReward: number;
  /** 현재 위치 (타일 좌표, 소수) */
  pos: Point;
  /** 배정된 경로 인덱스 (map.paths) */
  pathId: number;
  /** 다음 웨이포인트 인덱스 */
  pathIndex: number;
  /** 스폰 시 적용된 배수 (분열 자식 생성용) */
  hpMult: number;
  goldMult: number;
  slowPct: number;
  slowUntil: number;
  stunUntil: number;
  /** 피격 플래시 연출용 타임스탬프 */
  hitFlashUntil: number;
  /** 마지막 이동 x 방향 (-1/1, 스프라이트 반전용) */
  facing: number;
  dead: boolean;
  reached: boolean;
}

export interface TowerBuff {
  type: "atk_speed";
  pct: number;
  until: number;
}

/** 타워 타겟팅 모드 */
export type TargetMode = "first" | "last" | "strongest" | "boss";

export interface TowerUnit {
  uid: string;
  defId: string;
  /** 배치 타일 (null이면 대기석) */
  tile: Point | null;
  mana: number;
  /** 다음 공격 가능 시각 */
  nextAttackAt: number;
  kills: number;
  totalDamage: number;
  buffs: TowerBuff[];
  /** 공격 모션 연출 (0~1, 감쇠) */
  attackAnim: number;
  /** 스킬 모션 연출 종료 시각 */
  skillAnimUntil: number;
  /** 마지막 공격 대상 방향 (rad) */
  aimAngle: number;
  targetMode: TargetMode;
}

// ------------------------------------------------------------
// 저장 스냅샷 (직렬화 가능한 순수 데이터)
// ------------------------------------------------------------

export interface SpawnEntrySnapshot {
  at: number;
  defId: string;
  hpMult: number;
  goldMult: number;
  pathId: number;
}

export interface GameSnapshot {
  version: 1;
  seed: number;
  rngState: number;
  time: number;
  gold: number;
  lives: number;
  wave: number;
  phase: GamePhase;
  bench: TowerUnit[];
  placed: TowerUnit[];
  enemies: EnemyUnit[];
  projectiles: Projectile[];
  spawnQueue: SpawnEntrySnapshot[];
  waveStartTime: number;
  waveSpawnDone: boolean;
  spawnCounter: number;
  jobSkillReadyAt: [number, number][];
  jobSkillUsesLeft: number;
  globalBuffs: GlobalBuff[];
  logs: { text: string; color?: string }[];
  /** 조기 호출로 이어 붙인 웨이브 수 (이전 버전 세이브에는 없음) */
  chainedWaves?: number;
  /** 진행 중인 웨이브 미션 (이전 버전 세이브에는 없음) */
  mission?: MissionState | null;
}

/** 진행 중인 웨이브 미션 상태 */
export interface MissionState {
  missionId: string;
  /** 미션이 부여된 웨이브 */
  wave: number;
  startTime: number;
  status: "active" | "failed";
  /** boss_within: 보스 처치 시각 */
  bossKilledAt?: number;
}

/** localStorage에 저장되는 세이브 슬롯 */
export interface SaveSlot {
  chapterId: string;
  stageId: string;
  jobId: string;
  difficulty: Difficulty;
  savedAt: number;
  snapshot: GameSnapshot;
}

/** 직업 액티브 스킬로 걸린 아군 전체 버프 */
export interface GlobalBuff {
  stat: JobBuffStat;
  value: number;
  until: number;
}

export interface Projectile {
  uid: string;
  pos: Point;
  targetUid: string;
  speed: number; // 타일/초
  damage: number;
  damageType: DamageType;
  crit: boolean;
  color: string;
  sourceUid: string;
  /** 명중 시 발동할 스킬 여부 */
  fromSkill: boolean;
}

export interface EffectFx {
  uid: string;
  kind: "hit" | "crit" | "aoe" | "slow" | "stun" | "buff" | "death" | "skill_text";
  pos: Point;
  t: number; // 경과 시간
  duration: number;
  radius?: number;
  color: string;
  text?: string;
}

export interface FloatingText {
  uid: string;
  pos: Point;
  text: string;
  color: string;
  t: number;
  duration: number;
  crit?: boolean;
}

export type GamePhase = "prep" | "wave" | "victory" | "defeat";

export interface ActiveSynergy {
  synergyId: string;
  region: Region;
  name: string;
  color: string;
  count: number;
  activeTierIndex: number; // -1 = 미발동
  tiers: SynergyTier[];
  description?: string;
}

/**
 * 엔진 이벤트 — 사운드 등 UI 연출용 (엔진은 기록만, UI가 drainEvents()로 소비)
 */
export type GameEventType =
  | "shot"
  | "hit"
  | "crit"
  | "skill"
  | "kill"
  | "boss_spawn"
  | "boss_kill"
  | "leak"
  | "wave_start"
  | "early_call"
  | "wave_clear"
  | "gacha"
  | "gacha_legendary"
  | "fusion"
  | "fusion_jackpot"
  | "place"
  | "sell"
  | "job_skill"
  | "mission_success"
  | "mission_fail"
  | "victory"
  | "defeat";
