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
  | "legendary" // 전설
  | "esther"; // 에스더

/** 지역(시너지) - 데이터 주도. 예: 슈샤이어, 애니츠, 아르데타인 ... */
export type Region = string;

export type DamageType = "physical" | "magical";

export type Difficulty = "easy" | "hard" | "nightmare";

/** 외형 placeholder. image가 지정되면 image 우선 렌더링 */
export interface Appearance {
  color: string; // 주 색상 (hex)
  shape: "circle" | "square" | "triangle" | "diamond" | "star";
  icon: string; // 이모지 placeholder
  image?: string; // /characters/xxx.png (추후 카툰 그래픽 교체용)
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
}

// ------------------------------------------------------------
// 적 캐릭터
// ------------------------------------------------------------

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  defense: number; // 방어력 (물리 피해 감소)
  magicDefense: number; // 마법 방어력
  moveSpeed: number; // 초당 이동 타일 수
  isBoss: boolean;
  goldReward: number; // 처치 골드
  appearance: Appearance;
  description?: string;
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
  | "crit_chance";

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
  /** 이 지역 시너지 캐릭터 수 +1 (TFT 상징 아이템 개념) */
  synergyRegion?: Region;
  skills: JobSkill[];
  appearance?: Appearance;
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

export interface StageDef {
  id: string;
  name: string;
  /** 총 웨이브 수 */
  waves: number;
  /** 등장하는 일반 적 id 목록 */
  enemyIds: string[];
  /** 보스 웨이브에 등장할 보스 적 id (없으면 전체 보스 풀에서) */
  bossId?: string;
  /** 스테이지 체력/골드 배수 */
  hpMult: number;
  goldMult: number;
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
  slowPct: number;
  slowUntil: number;
  stunUntil: number;
  /** 피격 플래시 연출용 타임스탬프 */
  hitFlashUntil: number;
  dead: boolean;
  reached: boolean;
}

export interface TowerBuff {
  type: "atk_speed";
  pct: number;
  until: number;
}

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
  /** 마지막 공격 대상 방향 (rad) */
  aimAngle: number;
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
