import type { Difficulty, Grade } from "./types";

// ------------------------------------------------------------
// 등급
// ------------------------------------------------------------

export const GRADE_ORDER: Grade[] = [
  "common",
  "uncommon",
  "rare",
  "hero",
  "legendary",
  "esther",
];

export const GRADE_LABEL: Record<Grade, string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  hero: "영웅",
  legendary: "전설",
  esther: "에스더",
};

export const GRADE_COLOR: Record<Grade, string> = {
  common: "#9ca3af",
  uncommon: "#4ade80",
  rare: "#38bdf8",
  hero: "#c084fc",
  legendary: "#fb923c",
  esther: "#22d3ee",
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

/** 타워 판매 환급률 (%) - 뽑기 기본 비용 기준 */
export const SELL_REFUND_PCT = 50;

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
