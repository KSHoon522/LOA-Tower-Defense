import type { Difficulty, EntityKind, Grade, MissionCondition, MissionConditionType } from "./types";

// ------------------------------------------------------------
// 등급
// ------------------------------------------------------------

export const GRADE_ORDER: Grade[] = [
  "common",
  "uncommon",
  "rare",
  "hero",
  "legendary",
];

export const GRADE_LABEL: Record<Grade, string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  hero: "영웅",
  legendary: "전설",
};

/** 등급 색 (로스트아크 아이템 등급 색) */
export const GRADE_COLOR: Record<Grade, string> = {
  common: "#b5b5b5",
  uncommon: "#8df901",
  rare: "#00b0fa",
  hero: "#ce43fc",
  legendary: "#f99200",
};

/** 등급 슬롯 배경 그라데이션 [어두운 쪽, 밝은 쪽] (로스트아크 아이템 슬롯 배경) */
export const GRADE_BG: Record<Grade, [string, string]> = {
  common: ["#232323", "#575757"],
  uncommon: ["#18220b", "#304911"],
  rare: ["#111f2c", "#113d5d"],
  hero: ["#201e2e", "#481d5e"],
  legendary: ["#362003", "#9e5f04"],
};

/** 합성으로 도달 가능한 최대 등급 */
export const MAX_FUSION_GRADE: Grade = "legendary";

// ------------------------------------------------------------
// 난이도
// ------------------------------------------------------------

export interface DifficultyConfig {
  label: string;
  enemyHpMult: number;
  enemyDefMult: number;
  lives: number;
  startGold: number;
  /** 게임 전체에서 직업 액티브 스킬을 사용할 수 있는 총 횟수 */
  jobSkillUses: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { label: "이지", enemyHpMult: 1.0, enemyDefMult: 1.0, lives: 10, startGold: 120, jobSkillUses: 15 },
  hard: { label: "하드", enemyHpMult: 1.8, enemyDefMult: 1.3, lives: 6, startGold: 100, jobSkillUses: 10 },
  nightmare: { label: "나이트메어", enemyHpMult: 3.0, enemyDefMult: 1.6, lives: 3, startGold: 80, jobSkillUses: 6 },
};

// ------------------------------------------------------------
// 뽑기 (가챠)
// 종류/비용/확률은 data/gachas.json에서 CRUD로 관리 (/editor/gachas)
// ------------------------------------------------------------

/** 판매 환급 기준 골드 (등급당 2배씩 증가) */
export const SELL_BASE_GOLD = 20;

// ------------------------------------------------------------
// 합성
// ------------------------------------------------------------

/** 합성 시 부모 지역 상속 확률 (%) - 각 부모 40%, 그 외 지역 20% */
export const FUSION_PARENT_REGION_PCT = 40;
/** 합성 시 2단계 상위 등급 확률 (%) */
export const FUSION_JACKPOT_PCT = 1;

// ------------------------------------------------------------
// 전투
// ------------------------------------------------------------

/** 기본 치명타 확률 (%) */
export const BASE_CRIT_CHANCE = 10;
/** 기본 치명타 피해 (%) */
export const BASE_CRIT_DAMAGE = 160;

/** 방어력 공식 상수: 감소율 = def / (def + K) */
export const DEFENSE_K = 100;

/** 투사체 속도 (타일/초) */
export const PROJECTILE_SPEED = 10;

/** 웨이브 간 준비 시간에 자동 시작 여부 없이 수동 시작 */
export const WAVES_PER_BOSS = 5;
/** 총 웨이브 수 기본값 (스테이지 미지정 시) */
export const TOTAL_WAVES = 30;

/** 맵 당 최대 경로 수 */
export const MAX_PATHS = 3;

/** 경로별 표시 색상 */
export const PATH_COLORS = ["#fbbf24", "#38bdf8", "#fb7185"];

/** 웨이브당 적 수 기본값 */
export const WAVE_ENEMY_COUNT = 10;
/** 웨이브 스폰 간격(초) */
export const SPAWN_INTERVAL = 0.7;

/** 웨이브별 적 체력 성장 계수 (wave-1 거듭제곱) */
export const WAVE_HP_GROWTH = 1.18;
/** 웨이브별 골드 보상 성장 */
export const WAVE_GOLD_GROWTH = 1.05;

/** 웨이브 클리어 보너스 골드 */
export const WAVE_CLEAR_GOLD = 25;

/** 웨이브 클리어 시 보유 골드 이자 (%) 및 상한 */
export const INTEREST_PCT = 5;
export const INTEREST_CAP = 30;

/**
 * 웨이브 조기 호출 보너스: 현재 웨이브 스폰이 끝난 뒤 남은 적이 있을 때 다음 웨이브를 부르면
 * 기본 + 남은 적 수(보스는 가중치) × 계수, 상한 적용
 */
export const EARLY_CALL_BASE_GOLD = 5;
export const EARLY_CALL_GOLD_PER_ENEMY = 2;
export const EARLY_CALL_BOSS_WEIGHT = 5;
export const EARLY_CALL_MAX_GOLD = 30;

/** 보스 웨이브 체력 배수 */
export const BOSS_HP_MULT = 6;
/** 보스 골드 배수 */
export const BOSS_GOLD_MULT = 5;

/** 타워 타겟팅 모드 라벨 */
export const TARGET_MODE_LABEL: Record<
  "first" | "last" | "strongest" | "boss",
  string
> = {
  first: "선두 우선",
  last: "후미 우선",
  strongest: "최대 체력",
  boss: "보스 우선",
};

/** 미션 조건 라벨 (UI/에디터) */
export const MISSION_CONDITION_LABEL: Record<MissionConditionType, string> = {
  no_leak: "목숨 손실 없이 클리어",
  clear_within: "N초 이내 클리어",
  no_job_skill: "직업 스킬 없이 클리어",
  max_placed: "배치 타워 N개 이하로 클리어",
  boss_within: "N초 이내 보스 처치",
};

/** 미션 조건 한 줄 설명 (에디터 목록 / 게임 화면 공용) */
export function describeMissionCondition(c: MissionCondition): string {
  switch (c.type) {
    case "clear_within":
      return `${c.seconds}초 이내 클리어`;
    case "max_placed":
      return `배치 타워 ${c.count}개 이하로 클리어`;
    case "boss_within":
      return `${c.seconds}초 이내 보스 처치`;
    default:
      return MISSION_CONDITION_LABEL[c.type];
  }
}

/**
 * 타워 판매 환급률 (%) — 판매가 = SELL_BASE_GOLD × 2^등급 × 환급률 (일반 5G … 전설 80G)
 * 뽑기 1회의 판매 환급 기대값이 뽑기 비용보다 크면 뽑기→판매 반복으로 골드가 무한히 늘어나므로
 * 올릴 때는 에디터의 데이터 점검 경고를 확인할 것 (기본 뽑기 20G 기준 약 32% 미만이어야 안전)
 */
export const SELL_REFUND_PCT = 25;

/** 대기석 최대 크기 */
export const BENCH_SIZE = 9;

// ------------------------------------------------------------
// 지역 (기본 시드 - CRUD로 자유 추가 가능)
// ------------------------------------------------------------

export const DEFAULT_REGIONS: string[] = [
  "슈샤이어",
  "애니츠",
  "아르데타인",
  "베른",
  "로헨델",
  "파푸니카",
];

// ------------------------------------------------------------
// 데이터 (CRUD 대상 엔티티 = data/<kind>.json)
// ------------------------------------------------------------

export const ENTITY_KINDS: EntityKind[] = [
  "maps",
  "jobs",
  "towers",
  "enemies",
  "synergies",
  "gachas",
  "chapters",
  "missions",
];

export const ENTITY_LABEL: Record<EntityKind, string> = {
  maps: "맵",
  jobs: "직업",
  towers: "캐릭터",
  enemies: "적",
  synergies: "시너지",
  gachas: "뽑기",
  chapters: "챕터",
  missions: "미션",
};
