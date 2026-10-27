// ============================================================
// 전장 바닥 테마 — 챕터 지역(없으면 맵 지역)으로 고름
// - 시너지 대륙 이름뿐 아니라 토토이크·유디아처럼 대륙에 합쳐진 지명도 각자 테마를 가짐
// ============================================================

/** 막힌 칸 장식 종류 */
export type DecorKind =
  | "rock"
  | "bush"
  | "tree"
  | "pine"
  | "palm"
  | "cactus"
  | "crystal"
  | "mushroom"
  | "bamboo"
  | "deadtree"
  | "pillar"
  | "lavarock";

/** 칸 위 잔무늬 종류 */
export type DetailKind = "tuft" | "flower" | "petal" | "snow" | "pebble" | "sparkle" | "crack" | "shell" | "ember";

export interface FloorTheme {
  /** 화면에 보이는 지형 이름 */
  label: string;
  /** UI 강조색 (로비 챕터 표시 등) */
  accent: string;
  /** 전장 바깥 나무틀 색 */
  frame: string;
  /** 칸 사이 틈 */
  base: string;
  /** 건설 불가 빈 땅 */
  empty: string;
  /** 건설 칸 체크무늬 두 색 */
  tile: [string, string];
  /** 건설 칸 아래 두께 */
  lip: string;
  detail: DetailKind;
  detailColors: [string, string];
  road: {
    /** 길 가장자리 / 길 면 / 가운데 밝은 줄 / 자갈 */
    edge: string;
    fill: string;
    center: string;
    pebble: string;
    style: "dirt" | "stone" | "plank" | "asphalt";
  };
  /** 막힌 칸 장식 후보 (여러 번 넣으면 더 자주 나옴) */
  decor: DecorKind[];
  /** [그늘, 밝은 면] */
  rock: [string, string];
  leaf: [string, string];
  trunk: string;
  /** 수정·버섯 갓 등 포인트 색 */
  gem: string;
}

const MEADOW: FloorTheme = {
  label: "초원",
  accent: "#4cc23a",
  frame: "#8a5a2b",
  base: "#3f9636",
  empty: "#55ad41",
  tile: ["#72cc55", "#69c34d"],
  lip: "#46923a",
  detail: "tuft",
  detailColors: ["#3a842f", "#fff6c2"],
  road: { edge: "#b47a3f", fill: "#ecc583", center: "rgba(255,244,214,0.35)", pebble: "#c4945a", style: "dirt" },
  decor: ["rock", "rock", "bush", "bush", "tree"],
  rock: ["#7f88a3", "#a9b2c9"],
  leaf: ["#2f8f2c", "#47b23a"],
  trunk: "#8a5a2b",
  gem: "#ff5d73",
};

/** 지형 이름 → 테마 */
export const FLOOR_THEMES: Record<string, FloorTheme> = {
  초원: MEADOW,
  가을들판: {
    ...MEADOW,
    label: "가을 들판",
    accent: "#e0a43a",
    base: "#a38b3a",
    empty: "#bfa24c",
    tile: ["#dcc46a", "#d3ba5f"],
    lip: "#a8913f",
    detailColors: ["#8f7a2c", "#ffe9a8"],
    decor: ["tree", "tree", "bush", "rock"],
    leaf: ["#d9661f", "#f59a3a"],
  },
  숲: {
    ...MEADOW,
    label: "모코코 숲",
    accent: "#7ee35a",
    base: "#2f8a3a",
    empty: "#4fb04a",
    tile: ["#7fd65a", "#76cd52"],
    lip: "#3f8f35",
    detail: "flower",
    detailColors: ["#ff9ec0", "#fff27a"],
    decor: ["mushroom", "mushroom", "tree", "bush", "rock"],
    leaf: ["#2b8a3a", "#4cc04f"],
    gem: "#ff5d5d",
  },
  동양: {
    ...MEADOW,
    label: "벚꽃 언덕",
    accent: "#ff9ec0",
    frame: "#6b3b2a",
    base: "#4f8f5a",
    empty: "#7fb56b",
    tile: ["#a8d48c", "#9ecb83"],
    lip: "#6a9f5c",
    detail: "petal",
    detailColors: ["#ffb3c7", "#ffd6e2"],
    road: { edge: "#7d786f", fill: "#b9b4a8", center: "rgba(255,255,255,0.25)", pebble: "#8c877d", style: "stone" },
    decor: ["bamboo", "bamboo", "tree", "rock"],
    leaf: ["#e8789c", "#ffb8cc"],
    trunk: "#6b3b2a",
  },
  사막: {
    ...MEADOW,
    label: "사막",
    accent: "#f59e0b",
    frame: "#7a4a22",
    base: "#c98f4a",
    empty: "#e2a95f",
    tile: ["#f4c47c", "#ecba70"],
    lip: "#c28a45",
    detail: "pebble",
    detailColors: ["#c27f3f", "#e2a35f"],
    road: { edge: "#3e3944", fill: "#5d5763", center: "#ffd23a", pebble: "#4a4450", style: "asphalt" },
    decor: ["cactus", "cactus", "rock", "rock"],
    rock: ["#a0643a", "#d08a52"],
    leaf: ["#3f9a4a", "#5fbf5f"],
  },
  왕국: {
    ...MEADOW,
    label: "왕국 광장",
    accent: "#a78bfa",
    frame: "#5a4a6e",
    base: "#6b7a99",
    empty: "#8f9bb8",
    tile: ["#c9d1e3", "#bfc8dc"],
    lip: "#8a96b3",
    detail: "crack",
    detailColors: ["#9aa5bf", "#e4e9f4"],
    road: { edge: "#9a5532", fill: "#d4865a", center: "rgba(255,230,200,0.3)", pebble: "#b06a40", style: "stone" },
    decor: ["bush", "bush", "pillar", "tree"],
    leaf: ["#2f8f4a", "#4fbf5f"],
  },
  설원: {
    ...MEADOW,
    label: "설원",
    accent: "#7dd3fc",
    frame: "#5a7aa6",
    base: "#9fb9d9",
    empty: "#d7e6f7",
    tile: ["#f6faff", "#eaf2fc"],
    lip: "#b9cde6",
    detail: "snow",
    detailColors: ["#b8d4f0", "#ffffff"],
    road: { edge: "#7fa3cc", fill: "#bcd7f0", center: "rgba(255,255,255,0.55)", pebble: "#9cc0e3", style: "dirt" },
    decor: ["pine", "pine", "rock", "crystal"],
    rock: ["#8fb3d9", "#d2e6f8"],
    leaf: ["#2f6f5a", "#3f8f6f"],
    gem: "#7dd3fc",
  },
  정령숲: {
    ...MEADOW,
    label: "정령의 숲",
    accent: "#2fd1a6",
    frame: "#2f5a4a",
    base: "#1f7a6e",
    empty: "#2f9a86",
    tile: ["#62d2b2", "#58c8a8"],
    lip: "#2f8f7a",
    detail: "sparkle",
    detailColors: ["#d2fff2", "#fff6b0"],
    road: { edge: "#bdb59c", fill: "#ece7d6", center: "rgba(255,255,255,0.4)", pebble: "#d2cbb5", style: "stone" },
    decor: ["mushroom", "tree", "tree", "crystal", "bush"],
    leaf: ["#167a5c", "#2fb58a"],
    gem: "#b48cff",
  },
  화산: {
    ...MEADOW,
    label: "화산 대장간",
    accent: "#ff7a3c",
    frame: "#3b2622",
    base: "#3b2b2b",
    empty: "#5a3f38",
    tile: ["#8a6656", "#80604f"],
    lip: "#4a332c",
    detail: "ember",
    detailColors: ["#ff8a3c", "#ffd23a"],
    road: { edge: "#2f2a33", fill: "#5a5560", center: "rgba(255,140,60,0.45)", pebble: "#3f3a44", style: "stone" },
    decor: ["lavarock", "lavarock", "rock", "crystal"],
    rock: ["#4a3a3a", "#6e5a55"],
    gem: "#ff9a3c",
  },
  마계: {
    ...MEADOW,
    label: "마계",
    accent: "#c084fc",
    frame: "#3a1f3f",
    base: "#3a1f3f",
    empty: "#5a2f5a",
    tile: ["#875283", "#7e4a7a"],
    lip: "#4f2a4c",
    detail: "crack",
    detailColors: ["#4f2a4c", "#c084fc"],
    road: { edge: "#5a2234", fill: "#9a4558", center: "rgba(255,140,170,0.25)", pebble: "#6b2a40", style: "dirt" },
    decor: ["deadtree", "deadtree", "crystal", "rock"],
    rock: ["#4a3550", "#6e5577"],
    trunk: "#4a2f3f",
    gem: "#d07bff",
  },
  열대: {
    ...MEADOW,
    label: "열대 섬",
    accent: "#ff8a3c",
    frame: "#8a5a2b",
    base: "#e2bb72",
    empty: "#f3d697",
    tile: ["#9be06a", "#90d660"],
    lip: "#5fae45",
    detail: "flower",
    detailColors: ["#ff5d73", "#ffd23a"],
    road: { edge: "#d4a865", fill: "#f8e6b6", center: "rgba(255,255,255,0.35)", pebble: "#e0bf80", style: "dirt" },
    decor: ["palm", "palm", "bush", "rock"],
    leaf: ["#2f9a3a", "#5fd04a"],
  },
  바다섬: {
    ...MEADOW,
    label: "바다 위 섬",
    accent: "#2dd4bf",
    frame: "#7f5530",
    base: "#2fb2d6",
    empty: "#5fd0ec",
    tile: ["#f7e2a8", "#f1d999"],
    lip: "#d9b46a",
    detail: "shell",
    detailColors: ["#ffb3a0", "#ffffff"],
    road: { edge: "#7f5530", fill: "#c08a55", center: "rgba(255,230,190,0.25)", pebble: "#a8763f", style: "plank" },
    decor: ["palm", "palm", "rock"],
    rock: ["#8a8f9f", "#b9bfcf"],
    leaf: ["#2f9a3a", "#5fd04a"],
  },
  호수: {
    ...MEADOW,
    label: "신비의 호수",
    accent: "#c4b5fd",
    frame: "#4a4a8a",
    base: "#6a6fc4",
    empty: "#9aa4e6",
    tile: ["#d3d7ff", "#c9cdf8"],
    lip: "#9aa0dc",
    detail: "sparkle",
    detailColors: ["#ffffff", "#ffe9a8"],
    road: { edge: "#b8b2e0", fill: "#f4f1ff", center: "rgba(196,181,253,0.4)", pebble: "#d8d2f5", style: "stone" },
    decor: ["crystal", "crystal", "tree", "rock"],
    rock: ["#8f8ac4", "#bdb8ec"],
    leaf: ["#8b6fd6", "#b89cf0"],
    gem: "#9fe7ff",
  },
  천상: {
    ...MEADOW,
    label: "천상",
    accent: "#ffd76a",
    frame: "#b8954a",
    base: "#e2d39f",
    empty: "#fff3cc",
    tile: ["#ffffff", "#f7f4ff"],
    lip: "#dcd1a8",
    detail: "sparkle",
    detailColors: ["#ffd76a", "#ffffff"],
    road: { edge: "#d9a93a", fill: "#ffe08a", center: "rgba(255,255,255,0.5)", pebble: "#f2c45a", style: "stone" },
    decor: ["pillar", "pillar", "crystal", "bush"],
    leaf: ["#e8e4ff", "#ffffff"],
    gem: "#ffd76a",
  },
  소금사막: {
    ...MEADOW,
    label: "소금 사막",
    accent: "#f0abc0",
    frame: "#8a6a72",
    base: "#d4bec6",
    empty: "#ecdde3",
    tile: ["#fdf6f8", "#f5ebef"],
    lip: "#d8c4cc",
    detail: "crack",
    detailColors: ["#dcc6ce", "#ffffff"],
    road: { edge: "#b08a70", fill: "#e2c2a8", center: "rgba(255,255,255,0.35)", pebble: "#c9a68c", style: "dirt" },
    decor: ["crystal", "rock", "cactus"],
    rock: ["#b9a3ad", "#e4d6dc"],
    gem: "#ffffff",
  },
};

/** 지역 이름 → 지형 이름 */
const REGION_THEME: Record<string, string> = {
  루테란: "초원",
  아르테미스: "가을들판",
  유디아: "소금사막",
  토토이크: "숲",
  애니츠: "동양",
  아르데타인: "사막",
  베른: "왕국",
  엘가시아: "천상",
  슈샤이어: "설원",
  로헨델: "정령숲",
  욘: "화산",
  페이튼: "마계",
  파푸니카: "열대",
  섬: "바다섬",
  대양: "바다섬",
  림레이크: "호수",
};

/** 바닥 테마를 정할 수 있는 지역 이름 목록 (에디터 선택지) */
export const THEMED_REGIONS = Object.keys(REGION_THEME);

/** 지역 이름으로 바닥 테마 찾기 (지형 이름을 직접 넣어도 됨, 모르면 초원) */
export function floorTheme(region?: string | null): FloorTheme {
  if (!region) return MEADOW;
  return FLOOR_THEMES[REGION_THEME[region] ?? region] ?? MEADOW;
}
