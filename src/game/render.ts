import { GRADE_BG, GRADE_COLOR, PATH_COLORS } from "./constants";
import type { GameEngine } from "./engine";
import type { Appearance, EnemyUnit, MapDef, Point, TowerDef, TowerUnit } from "./types";

// ============================================================
// 캔버스 렌더러
// - 카툰풍: 굵은 외곽선 + 납작한 셀 음영 + 통통 튀는 움직임
// - 정적 판(잔디 칸/흙길/덤불·바위)은 오프스크린 캔버스에 한 번 그려 재사용
// - 세로 화면에서는 맵을 90° 돌려 그림(rotated): 맵 위쪽 → 화면 왼쪽
// - 엔진 좌표는 타일 중심이 정수, 화면 좌표는 projector로 변환
// ============================================================

export interface ViewState {
  tileSize: number;
  /** 세로 화면용 90° 회전 */
  rotated: boolean;
  dpr: number;
  selectedUid: string | null;
  /** 배치 대기 중인 대기석 유닛 (선택된 대기석 유닛) */
  placingUid: string | null;
  hoverTile: Point | null;
  /** 드래그 중인 배치 타워 */
  dragUid: string | null;
  /** 드래그 현재 위치 (엔진 좌표) */
  dragPos: Point | null;
  /** 합성 가능 후보 (선택 유닛과 같은 등급) */
  fusionCandidates: Set<string>;
  fusionTargetUid: string | null;
  /** 직업 스킬 조준 모드: 반경 (타일) */
  aimRadius: number | null;
  /** 이미지 캐시 (appearance.image 경로 → HTMLImageElement) */
  imageCache: Map<string, HTMLImageElement>;
  /** 실제 시각(ms, performance.now) — 일시정지 중에도 흐르는 연출용 */
  now: number;
  /** 화면 흔들림 종료 시각(ms) */
  shakeUntil: number;
  /** '움직임 줄이기' 설정 — 흔들림 등 생략 */
  reducedMotion: boolean;
  /** 연출용 캐시 */
  cache: RenderCache;
}

interface RenderCache {
  board: { key: string; canvas: HTMLCanvasElement; paths: ScreenPath[] } | null;
  /** uid → 처음 그린 시각(ms): 등장 연출 */
  seen: Map<string, number>;
  /** 적 uid → 잔상 체력 비율 */
  hpTrail: Map<string, number>;
  /** 적 uid → 마지막 화면 x, 바라보는 방향 */
  facing: Map<string, { x: number; f: number }>;
  /** 투사체 uid → 최근 화면 좌표 [x0, y0, x1, y1, …] */
  trails: Map<string, number[]>;
  lastFrame: number;
  frame: number;
}

interface ScreenPath {
  pts: [number, number][];
  /** 누적 길이 */
  acc: number[];
  color: string;
}

export function createViewState(tileSize: number): ViewState {
  return {
    tileSize,
    rotated: false,
    dpr: 1,
    selectedUid: null,
    placingUid: null,
    hoverTile: null,
    dragUid: null,
    dragPos: null,
    fusionCandidates: new Set(),
    fusionTargetUid: null,
    aimRadius: null,
    imageCache: new Map(),
    now: 0,
    shakeUntil: 0,
    reducedMotion: false,
    cache: {
      board: null,
      seen: new Map(),
      hpTrail: new Map(),
      facing: new Map(),
      trails: new Map(),
      lastFrame: 0,
      frame: 0,
    },
  };
}

/** 화면에 그려지는 칸 수 (회전 시 가로세로가 바뀜) */
export function displaySize(map: Pick<MapDef, "cols" | "rows">, rotated: boolean) {
  return rotated ? { cols: map.rows, rows: map.cols } : { cols: map.cols, rows: map.rows };
}

/** 화면 칸 좌표(u, v: 0 ~ 표시 칸 수, 소수) → 엔진 좌표 (타일 중심이 정수) */
export function screenToMap(map: Pick<MapDef, "cols">, rotated: boolean, u: number, v: number): Point {
  return rotated ? { x: map.cols - v - 0.5, y: u - 0.5 } : { x: u - 0.5, y: v - 0.5 };
}

type ToScreen = (x: number, y: number) => [number, number];

function projector(map: MapDef, ts: number, rotated: boolean): ToScreen {
  return rotated
    ? (x, y) => [(y + 0.5) * ts, (map.cols - 0.5 - x) * ts]
    : (x, y) => [(x + 0.5) * ts, (y + 0.5) * ts];
}

/** 엔진 각도 → 화면 각도 */
function screenAngle(a: number, rotated: boolean) {
  return rotated ? Math.atan2(-Math.cos(a), Math.sin(a)) : a;
}

// ------------------------------------------------------------
// 유틸
// ------------------------------------------------------------

function hash(a: number, b: number, s = 0): number {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

function parseHex(hex: string): [number, number, number] | null {
  if (!hex.startsWith("#")) return null;
  const m = hex.slice(1);
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.slice(0, 6);
  if (full.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function withAlpha(color: string, a: number): string {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : `rgba(255,255,255,${a})`;
}

function mix(color: string, to: string, t: number): string {
  const a = parseHex(color) ?? [160, 160, 160];
  const b = parseHex(to) ?? [0, 0, 0];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
/** 피해 숫자·말풍선 글꼴 (UI 제목 글꼴과 같음) */
const DISPLAY_FONT = '"Lilita One","Black Han Sans","Jua",sans-serif';

function getImage(view: ViewState, src: string): HTMLImageElement | null {
  let img = view.imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    view.imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export type AnimName = "idle" | "attack" | "skill" | "walk" | "death";

/** 애니메이션 상태: 어떤 동작을 몇 초째 재생 중인지 + 바라보는 방향 */
export interface AnimState {
  name: AnimName;
  t: number;
  facing: number; // 1 = 오른쪽, -1 = 왼쪽
}

/**
 * 스프라이트 시트 프레임 그리기
 * - 시트 형식: 가로로 프레임 나열, 줄(row)마다 다른 애니메이션
 * - 요청한 애니메이션이 없으면 idle로 대체, 방향에 따라 좌우 반전
 */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  app: Appearance,
  cx: number,
  cy: number,
  r: number,
  view: ViewState,
  anim: AnimState
): boolean {
  const sheet = app.sprite;
  if (!sheet) return false;
  const img = getImage(view, sheet.src);
  if (!img) return false;

  const def = sheet.animations[anim.name] ?? sheet.animations.idle;
  const frame = Math.max(0, Math.floor(anim.t * def.fps)) % Math.max(1, def.frames);
  const sx = frame * sheet.frameWidth;
  const sy = def.row * sheet.frameHeight;

  const size = r * 2.5 * (sheet.scale ?? 1);
  const aspect = sheet.frameHeight / sheet.frameWidth;
  const w = size;
  const h = size * aspect;

  const baseFacing = sheet.facing === "left" ? -1 : 1;
  const flip = (app.flipToFace ?? true) && anim.facing * baseFacing < 0;

  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sheet.frameWidth, sheet.frameHeight, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

/** 스프라이트 시트 또는 단일 이미지가 있으면 그리고 true */
function drawImageApp(
  ctx: CanvasRenderingContext2D,
  app: Appearance,
  cx: number,
  cy: number,
  r: number,
  view: ViewState,
  anim: AnimState
): boolean {
  if (drawSprite(ctx, app, cx, cy, r, view, anim)) return true;
  if (!app.image) return false;
  const img = getImage(view, app.image);
  if (!img) return false;
  const flip = (app.flipToFace ?? true) && anim.facing < 0;
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
  return true;
}

function shapePath(ctx: CanvasRenderingContext2D, shape: Appearance["shape"], cx: number, cy: number, r: number) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case "square":
      roundRect(ctx, cx - r * 0.86, cy - r * 0.86, r * 1.72, r * 1.72, r * 0.32);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.95, cy + r * 0.78);
      ctx.lineTo(cx - r * 0.95, cy + r * 0.78);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
  }
}

function drawEmoji(ctx: CanvasRenderingContext2D, icon: string, cx: number, cy: number, size: number) {
  // 컬러 이모지도 채움색의 투명도를 따라가므로 불투명하게 맞춤
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, cx, cy + size * 0.06);
}

// ------------------------------------------------------------
// 카툰 그리기 도구
// ------------------------------------------------------------

/** 모든 외곽선 색 (UI의 --line과 같은 짙은 남보라) */
const LINE = "#1b1438";

function outline(ctx: CanvasRenderingContext2D, w: number, color = LINE) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/** 뾰족한 별 / 터지는 모양 경로 */
function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  rot = -Math.PI / 2
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (Math.PI / points) * i;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.3, cy + s * 0.05, cx - s * 0.95, cy - s * 1.0, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.95, cy - s * 1.0, cx + s * 1.3, cy + s * 0.05, cx, cy + s * 0.9);
  ctx.closePath();
}

/** 굵은 외곽선 글자 (아래로 한 번 더 그려 두께감) */
function toonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string) {
  ctx.font = `${Math.round(size)}px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.3);
  ctx.strokeStyle = LINE;
  ctx.strokeText(text, x, y + size * 0.09);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// ------------------------------------------------------------
// 정적 판 (오프스크린 캐시)
// ------------------------------------------------------------

const GRASS = {
  /** 칸 사이 틈 / 빈 땅 */
  base: "#3f9636",
  empty: "#55ad41",
  tile: "#72cc55",
  tileAlt: "#69c34d",
  /** 칸 아래 두께 */
  lip: "#46923a",
  tuft: "#3a842f",
};
const ROAD = { edge: "#b47a3f", sand: "#ecc583", light: "rgba(255,244,214,0.35)", pebble: "#c4945a" };

/** 막힌 칸 장식: 바위 */
function drawRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number, seed: number, lw: number) {
  const pts = 7;
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
    const rr = ts * (0.3 + hash(i, 1, seed) * 0.1);
    const px = cx + Math.cos(a) * rr;
    const py = cy + ts * 0.04 + Math.sin(a) * rr * 0.8;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#7f88a3";
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx - ts * 0.08, cy - ts * 0.06, ts * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#a9b2c9";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - ts * 0.12, cy - ts * 0.14, ts * 0.09, ts * 0.05, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();
  ctx.restore();
  outline(ctx, lw);
  // 금
  ctx.beginPath();
  ctx.moveTo(cx + ts * 0.06, cy - ts * 0.08);
  ctx.lineTo(cx + ts * 0.12, cy + ts * 0.02);
  ctx.lineTo(cx + ts * 0.08, cy + ts * 0.1);
  outline(ctx, lw * 0.6);
}

/** 막힌 칸 장식: 덤불 */
function drawBush(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number, seed: number, lw: number) {
  const blobs: [number, number, number][] = [
    [-0.17, 0.06, 0.2],
    [0.17, 0.07, 0.19],
    [0, -0.08, 0.23],
  ].map(([x, y, r], i) => [cx + x * ts, cy + y * ts, r * ts * (0.92 + hash(i, 5, seed) * 0.16)]);
  // 외곽선을 먼저 굵게 깔고 그 위에 면을 채우면 겹친 안쪽 선이 사라짐
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    outline(ctx, lw * 2);
  }
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#2f8f2c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.15, y - r * 0.18, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = "#47b23a";
    ctx.fill();
  }
  // 열매
  if (hash(9, 9, seed) > 0.5) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx + (hash(i, 11, seed) - 0.5) * ts * 0.36, cy + (hash(i, 13, seed) - 0.6) * ts * 0.24, ts * 0.035, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5d73";
      ctx.fill();
      outline(ctx, lw * 0.5);
    }
  }
}

/** 막힌 칸 장식: 나무 */
function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, ts: number, seed: number, lw: number) {
  roundRect(ctx, cx - ts * 0.06, cy - ts * 0.02, ts * 0.12, ts * 0.3, ts * 0.04);
  ctx.fillStyle = "#8a5a2b";
  ctx.fill();
  outline(ctx, lw);
  const r = ts * (0.27 + hash(3, 3, seed) * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.12, r, 0, Math.PI * 2);
  ctx.fillStyle = "#2b8a3a";
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - ts * 0.12 - r * 0.22, r * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = "#3fb04b";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.38, cy - ts * 0.12 - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy - ts * 0.12, r, 0, Math.PI * 2);
  outline(ctx, lw);
}

function buildBoard(map: MapDef, ts: number, rotated: boolean, dpr: number) {
  const { cols, rows } = displaySize(map, rotated);
  const W = cols * ts;
  const H = rows * ts;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = projector(map, ts, rotated);
  const lw = Math.max(1.8, ts * 0.045);

  // 땅
  ctx.fillStyle = GRASS.base;
  ctx.fillRect(0, 0, W, H);

  // 칸: 건설 가능 칸은 살짝 솟은 잔디 블록, 빈 땅은 낮은 풀밭
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const t = map.tiles[y][x];
      if (t === "path") continue;
      const [cx, cy] = S(x, y);
      const x0 = cx - ts / 2;
      const y0 = cy - ts / 2;
      const m = Math.max(1.5, ts * 0.04);
      const r = ts * 0.18;
      if (t === "buildable") {
        const lip = Math.max(2, ts * 0.06);
        roundRect(ctx, x0 + m, y0 + m + lip * 0.6, ts - m * 2, ts - m * 2 - lip * 0.6, r);
        ctx.fillStyle = GRASS.lip;
        ctx.fill();
        roundRect(ctx, x0 + m, y0 + m, ts - m * 2, ts - m * 2 - lip * 0.6, r);
        ctx.fillStyle = (x + y) % 2 === 0 ? GRASS.tile : GRASS.tileAlt;
        ctx.fill();
        // 윗변 광택
        roundRect(ctx, x0 + m + ts * 0.14, y0 + m + ts * 0.07, ts - m * 2 - ts * 0.28, Math.max(1.5, ts * 0.05), ts * 0.03);
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fill();
      } else {
        roundRect(ctx, x0 + m * 0.5, y0 + m * 0.5, ts - m, ts - m, r);
        ctx.fillStyle = GRASS.empty;
        ctx.fill();
      }
      // 풀 포기
      if (hash(x, y, 41) < 0.55) {
        const px = x0 + ts * (0.2 + hash(x, y, 42) * 0.6);
        const py = y0 + ts * (0.35 + hash(x, y, 43) * 0.45);
        const s = ts * 0.07;
        ctx.beginPath();
        ctx.moveTo(px - s, py - s * 0.9);
        ctx.lineTo(px - s * 0.4, py);
        ctx.moveTo(px, py - s * 1.3);
        ctx.lineTo(px, py);
        ctx.moveTo(px + s, py - s * 0.9);
        ctx.lineTo(px + s * 0.4, py);
        outline(ctx, Math.max(1.2, ts * 0.025), GRASS.tuft);
      }
      // 빈 땅의 작은 꽃
      if (t === "empty" && hash(x, y, 51) < 0.3) {
        const px = x0 + ts * (0.25 + hash(x, y, 52) * 0.5);
        const py = y0 + ts * (0.25 + hash(x, y, 53) * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, ts * 0.045, 0, Math.PI * 2);
        ctx.fillStyle = hash(x, y, 54) < 0.5 ? "#fff6c2" : "#ffb3c7";
        ctx.fill();
        outline(ctx, Math.max(1, ts * 0.02));
      }
    }
  }

  // 길: 굵은 외곽선이 있는 모래 흙길
  const paths: ScreenPath[] = [];
  map.paths.forEach((path, pi) => {
    if (path.length < 2) return;
    const pts = path.map((p) => S(p.x, p.y));
    const acc = [0];
    for (let i = 1; i < pts.length; i++) {
      acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    paths.push({ pts, acc, color: PATH_COLORS[pi % PATH_COLORS.length] });
  });
  const strokeAll = (w: number, style: string) => {
    for (const p of paths) {
      ctx.beginPath();
      p.pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.lineWidth = w;
      ctx.strokeStyle = style;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };
  // 여러 경로가 겹쳐도 안쪽 선이 남지 않도록 층별로 모두 그림
  strokeAll(ts * 0.94, LINE);
  strokeAll(ts * 0.82, ROAD.edge);
  strokeAll(ts * 0.7, ROAD.sand);
  strokeAll(ts * 0.26, ROAD.light);
  // 길 위 자갈
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] !== "path") continue;
      const [cx, cy] = S(x, y);
      for (let i = 0; i < 2; i++) {
        const px = cx + (hash(x, y, i + 20) - 0.5) * ts * 0.5;
        const py = cy + (hash(x, y, i + 30) - 0.5) * ts * 0.5;
        ctx.beginPath();
        ctx.ellipse(px, py, ts * 0.045, ts * 0.032, 0, 0, Math.PI * 2);
        ctx.fillStyle = ROAD.pebble;
        ctx.fill();
      }
    }
  }

  // 막힌 칸 장식 (길보다 위에)
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] !== "blocked") continue;
      const [cx, cy] = S(x, y);
      const seed = Math.floor(hash(x, y, 61) * 1000);
      ctx.beginPath();
      ctx.ellipse(cx, cy + ts * 0.26, ts * 0.32, ts * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(27,20,56,0.25)";
      ctx.fill();
      const kind = hash(x, y, 62);
      if (kind < 0.45) drawRock(ctx, cx, cy, ts, seed, lw);
      else if (kind < 0.8) drawBush(ctx, cx, cy, ts, seed, lw);
      else drawTree(ctx, cx, cy, ts, seed, lw);
    }
  }

  // 가장자리 살짝 어둡게
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  vig.addColorStop(0, "rgba(27,20,56,0)");
  vig.addColorStop(1, "rgba(27,20,56,0.22)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  return { canvas, paths };
}

// ------------------------------------------------------------
// 동적 요소
// ------------------------------------------------------------

/** 길 위를 흐르는 화살표 (적 진행 방향) */
function drawFlow(ctx: CanvasRenderingContext2D, paths: ScreenPath[], ts: number, now: number) {
  const spacing = ts * 0.9;
  const offset = ((now / 1000) * ts * 0.55) % spacing;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of paths) {
    const total = p.acc[p.acc.length - 1];
    ctx.strokeStyle = withAlpha(p.color === PATH_COLORS[0] ? "#9a6431" : p.color, 0.5);
    ctx.lineWidth = Math.max(2, ts * 0.06);
    for (let d = offset + ts * 0.6; d < total - ts * 0.6; d += spacing) {
      let i = 1;
      while (i < p.acc.length - 1 && p.acc[i] < d) i++;
      const seg = p.acc[i] - p.acc[i - 1] || 1;
      const k = (d - p.acc[i - 1]) / seg;
      const [x0, y0] = p.pts[i - 1];
      const [x1, y1] = p.pts[i];
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k;
      const a = Math.atan2(y1 - y0, x1 - x0);
      const s = ts * 0.12;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s);
      ctx.lineTo(x, y);
      ctx.lineTo(x + Math.cos(a - 2.4) * s, y + Math.sin(a - 2.4) * s);
      ctx.stroke();
    }
  }
}

/** 출발지: 빙글빙글 도는 보라 소용돌이 */
function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, now: number) {
  const R = ts * 0.38;
  const lw = Math.max(2, ts * 0.055);
  ctx.beginPath();
  ctx.ellipse(x, y + R * 0.85, R * 0.9, R * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(27,20,56,0.3)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fillStyle = "#7c4ddb";
  ctx.fill();
  outline(ctx, lw);
  const a = now / 420;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R - lw / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, ts * 0.07);
  ctx.strokeStyle = "#c9b3ff";
  ctx.beginPath();
  ctx.arc(x, y, R * 0.68, a, a + Math.PI * 1.2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, R * 0.4, -a * 1.4, -a * 1.4 + Math.PI * 1.1);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, R * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "#2a1458";
  ctx.fill();
}

/** 도착지: 콩닥거리는 하트 (목숨) */
function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, now: number) {
  const beat = Math.pow(Math.max(0, Math.sin(now / 260)), 6);
  const s = ts * 0.3 * (1 + beat * 0.12);
  ctx.beginPath();
  ctx.ellipse(x, y + ts * 0.32, ts * 0.3, ts * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(27,20,56,0.3)";
  ctx.fill();
  heartPath(ctx, x, y, s);
  ctx.fillStyle = "#ff4d6d";
  ctx.fill();
  outline(ctx, Math.max(2, ts * 0.055));
  ctx.beginPath();
  ctx.ellipse(x - s * 0.45, y - s * 0.32, s * 0.2, s * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
}

/** 칸 커서: 둥근 네모 테두리 */
function drawTileCursor(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, color: string) {
  const m = ts * 0.05;
  roundRect(ctx, x - ts / 2 + m, y - ts / 2 + m, ts - m * 2, ts - m * 2, ts * 0.2);
  outline(ctx, 6, "rgba(27,20,56,0.6)");
  outline(ctx, 3, color);
}

/** 사거리 원: 옅은 채움 + 외곽선 두른 점선 */
function drawRange(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength = 1
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(color, 0.16 * strength);
  ctx.fill();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -now / 50;
  outline(ctx, 5.5, `rgba(27,20,56,${0.5 * strength})`);
  outline(ctx, 2.5, withAlpha(color, strength));
  ctx.setLineDash([]);
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  view: ViewState,
  t: TowerUnit,
  def: TowerDef,
  sx: number,
  sy: number,
  alpha: number
) {
  const ts = view.tileSize;
  const now = view.now;
  const R = ts * 0.4;
  const lw = Math.max(2, ts * 0.05);
  const color = GRADE_COLOR[def.grade];
  const [bg0, bg1] = GRADE_BG[def.grade];

  // 등장 연출: 작게 튀어나오며 커짐
  let seen = view.cache.seen.get(t.uid);
  if (seen === undefined) {
    seen = now;
    view.cache.seen.set(t.uid, now);
  }
  const age = now - seen;
  const appear = Math.min(1, age / 360);
  const scale = appear < 1 ? 0.4 + 0.6 * easeOutBack(appear) : 1;

  const a = screenAngle(t.aimAngle, view.rotated);
  const recoil = t.attackAnim * ts * 0.1;
  const ax = sx + Math.cos(a) * recoil;
  const ay = sy + Math.sin(a) * recoil;
  // 공격할 때 납작해졌다 펴짐
  const squash = t.attackAnim * 0.12;

  ctx.save();
  ctx.globalAlpha = alpha * Math.min(1, appear * 1.6);
  ctx.translate(ax, ay);
  ctx.scale(scale * (1 + squash), scale * (1 - squash));

  // 그림자
  ctx.fillStyle = "rgba(27,20,56,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, R * 0.78, R * 0.95, R * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // 받침 두께 + 윗면
  ctx.beginPath();
  ctx.arc(0, R * 0.14, R, 0, Math.PI * 2);
  ctx.fillStyle = mix(bg0, LINE, 0.35);
  ctx.fill();
  outline(ctx, lw);
  const ped = ctx.createLinearGradient(0, -R, 0, R);
  ped.addColorStop(0, bg1);
  ped.addColorStop(1, bg0);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = ped;
  ctx.fill();
  outline(ctx, lw);
  // 등급색 안쪽 테
  ctx.beginPath();
  ctx.arc(0, 0, R - lw * 0.5 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 윗부분 광택
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.5, R * 0.58, R * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();

  // 스킬 발동: 터지는 별 테두리
  if (t.skillAnimUntil > engine.time) {
    const k = Math.max(0, 1 - (t.skillAnimUntil - engine.time) / 0.6);
    const fr = R * (1.1 + easeOutCubic(k) * 0.7);
    ctx.globalAlpha = alpha * (1 - k);
    starPath(ctx, 0, 0, fr, fr * 0.78, 12, now / 400);
    ctx.fillStyle = withAlpha(color, 0.35);
    ctx.fill();
    outline(ctx, 2.5);
    ctx.globalAlpha = alpha * Math.min(1, appear * 1.6);
  }

  // 캐릭터 (스프라이트 > 이미지 > 이모지)
  const facing = Math.cos(a) < 0 ? -1 : 1;
  let anim: AnimState;
  if (t.skillAnimUntil > engine.time) {
    anim = { name: "skill", t: 0.6 - (t.skillAnimUntil - engine.time), facing };
  } else if (t.attackAnim > 0) {
    anim = { name: "attack", t: (1 - t.attackAnim) * 0.25, facing };
  } else {
    anim = { name: "idle", t: engine.time, facing };
  }
  const bob = Math.sin(now / 520 + hashStr(t.uid) * 6.28) * ts * 0.025;
  if (!drawImageApp(ctx, def.appearance, 0, -R * 0.12 + bob, ts * 0.32, view, anim)) {
    ctx.shadowColor = "rgba(27,20,56,0.55)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = Math.max(1.5, ts * 0.03);
    drawEmoji(ctx, def.appearance.icon, 0, -R * 0.06 + bob, R * 1.15);
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();

  // 전설: 주위를 도는 반짝이
  if (def.grade === "legendary" && alpha >= 1) {
    for (let i = 0; i < 3; i++) {
      const ang = now / 900 + (i * Math.PI * 2) / 3;
      const tw = 0.6 + 0.4 * Math.sin(now / 200 + i * 2);
      const px = sx + Math.cos(ang) * R * 1.05;
      const py = sy + Math.sin(ang) * R * 0.55 - R * 0.2;
      starPath(ctx, px, py, ts * 0.075 * tw, ts * 0.03 * tw, 4, now / 300);
      ctx.fillStyle = "#fff4b8";
      ctx.fill();
      outline(ctx, 1.5);
    }
  }

  // 등장 고리 (뿅!)
  if (age < 420) {
    const k = age / 420;
    ctx.beginPath();
    ctx.arc(sx, sy, R * (1 + easeOutCubic(k) * 0.9), 0, Math.PI * 2);
    outline(ctx, 6 * (1 - k) + 1, `rgba(27,20,56,${0.6 * (1 - k)})`);
    outline(ctx, 3.5 * (1 - k) + 0.5, `rgba(255,255,255,${1 - k})`);
  }
}

/** 받침 둘레의 마나 고리 (가득 차면 깜빡임) */
function drawManaRing(ctx: CanvasRenderingContext2D, sx: number, sy: number, R: number, ratio: number, now: number) {
  const rr = R + 3;
  ctx.beginPath();
  ctx.arc(sx, sy, rr, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#223088";
  ctx.stroke();
  if (ratio <= 0) return;
  const full = ratio >= 0.999;
  ctx.lineCap = "round";
  ctx.strokeStyle = full ? (Math.sin(now / 110) > 0 ? "#ffffff" : "#a5f3ff") : "#4fe0ff";
  ctx.beginPath();
  ctx.arc(sx, sy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
  ctx.stroke();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  view: ViewState,
  e: EnemyUnit,
  sx: number,
  sy: number,
  dt: number
) {
  const def = engine.enemyDefs.get(e.defId);
  if (!def) return;
  const ts = view.tileSize;
  const now = view.now;
  const r = e.isBoss ? ts * 0.42 : ts * 0.28;
  const lw = Math.max(1.8, r * 0.13);
  const h = hashStr(e.uid);

  let seen = view.cache.seen.get(e.uid);
  if (seen === undefined) {
    seen = now;
    view.cache.seen.set(e.uid, now);
  }
  const appear = Math.min(1, (now - seen) / 280);

  // 화면 기준 바라보는 방향
  const fc = view.cache.facing.get(e.uid);
  let facing = fc?.f ?? 1;
  if (fc && Math.abs(sx - fc.x) > 0.05) facing = sx > fc.x ? 1 : -1;
  view.cache.facing.set(e.uid, { x: sx, f: facing });

  // 깡총 뛰기: 공중에선 늘어나고 땅에 닿을 땐 찌그러짐
  const stunned = e.stunUntil > engine.time;
  const phase = stunned ? 0 : (now / (e.isBoss ? 460 : 320) + h) % 1;
  const hop = Math.sin(phase * Math.PI);
  const lift = hop * r * 0.3;
  const squash = stunned ? 0 : Math.pow(1 - hop, 4) * 0.18 - hop * 0.05;
  const by = sy - lift;

  ctx.save();
  ctx.globalAlpha = appear;

  // 그림자 (뛰어오르면 작아짐)
  ctx.fillStyle = "rgba(27,20,56,0.32)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + r * 0.86, r * (0.9 - hop * 0.25), r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // 보스: 바닥에 도는 붉은 점선 고리
  if (e.isBoss) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.6, r * 1.35, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(244,63,78,${0.12 + pulse * 0.1})`;
    ctx.fill();
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = -now / 40;
    outline(ctx, 2.5, "rgba(244,63,78,0.9)");
    ctx.setLineDash([]);
  }

  const stealth = def.traits?.some((tr) => tr.type === "stealth");
  if (stealth) ctx.globalAlpha = appear * (0.45 + 0.1 * Math.sin(now / 200 + h * 6));

  // 발 기준으로 찌그러뜨림
  ctx.save();
  ctx.translate(sx, by + r);
  ctx.scale(1 + squash, 1 - squash);
  ctx.translate(-sx, -(by + r));

  const anim: AnimState = { name: "walk", t: engine.time, facing };
  if (!drawImageApp(ctx, def.appearance, sx, by, r, view, anim)) {
    const base = def.appearance.color;
    // 셀 음영: 어두운 면을 깔고 왼쪽 위로 밝은 면을 덮어 오른쪽 아래에 그늘
    shapePath(ctx, def.appearance.shape, sx, by, r);
    ctx.fillStyle = mix(base, LINE, 0.38);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(sx - r * 0.16, by - r * 0.2, r * 0.98, 0, Math.PI * 2);
    ctx.fillStyle = base;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx - r * 0.38, by - r * 0.45, r * 0.26, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
    ctx.restore();
    shapePath(ctx, def.appearance.shape, sx, by, r);
    outline(ctx, lw);
    // 피격 섬광
    if (e.hitFlashUntil > engine.time) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * Math.min(1, (e.hitFlashUntil - engine.time) / 0.12)})`;
      ctx.fill();
    }
    ctx.save();
    if (facing < 0) {
      ctx.translate(sx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-sx, 0);
    }
    drawEmoji(ctx, def.appearance.icon, sx, by, r * 1.05);
    ctx.restore();
  }
  ctx.restore();

  // 둔화: 얼음 고리
  if (e.slowUntil > engine.time) {
    ctx.beginPath();
    ctx.arc(sx, by, r + 4, 0, Math.PI * 2);
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = now / 50;
    outline(ctx, 4.5, "rgba(27,20,56,0.55)");
    outline(ctx, 2.5, "#a5e8ff");
    ctx.setLineDash([]);
  }
  ctx.restore();

  // 기절: 머리 위를 도는 별
  if (stunned) {
    for (let i = 0; i < 3; i++) {
      const ang = now / 220 + (i * Math.PI * 2) / 3;
      const px = sx + Math.cos(ang) * r * 0.75;
      const py = by - r - ts * 0.07 + Math.sin(ang) * r * 0.22;
      starPath(ctx, px, py, ts * 0.075, ts * 0.032, 5, ang);
      ctx.fillStyle = "#ffe266";
      ctx.fill();
      outline(ctx, 1.5);
    }
  }

  // 체력 바 (보스는 항상, 일반 적은 피해를 입은 뒤부터) + 깎인 만큼 하얗게 남는 잔상
  const ratio = Math.max(0, e.hp / e.maxHp);
  let trail = view.cache.hpTrail.get(e.uid) ?? ratio;
  trail = Math.max(ratio, trail - dt * 0.9);
  view.cache.hpTrail.set(e.uid, trail);
  if (e.isBoss || ratio < 0.999) {
    const w = e.isBoss ? ts * 1.2 : ts * 0.66;
    const hgt = e.isBoss ? 8 : 5.5;
    const x = sx - w / 2;
    const y = by - r - (e.isBoss ? 17 : 11);
    roundRect(ctx, x - 2, y - 2, w + 4, hgt + 4, (hgt + 4) / 2);
    ctx.fillStyle = LINE;
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, w, hgt, hgt / 2);
    ctx.fillStyle = "#3a2c66";
    ctx.fill();
    ctx.clip();
    if (trail > ratio) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, w * trail, hgt);
    }
    ctx.fillStyle = e.isBoss ? "#ff6b72" : ratio > 0.5 ? "#7ee35a" : ratio > 0.25 ? "#ffd23a" : "#ff6b72";
    ctx.fillRect(x, y, w * ratio, hgt);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(x, y + hgt * 0.15, w * ratio, hgt * 0.3);
    ctx.restore();
    if (e.isBoss) {
      // 왕관
      const cx = x - 4;
      const cy = y + hgt / 2;
      const s = ts * 0.13;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy + s * 0.6);
      ctx.lineTo(cx - s, cy - s * 0.4);
      ctx.lineTo(cx - s * 0.45, cy + s * 0.05);
      ctx.lineTo(cx, cy - s * 0.7);
      ctx.lineTo(cx + s * 0.45, cy + s * 0.05);
      ctx.lineTo(cx + s, cy - s * 0.4);
      ctx.lineTo(cx + s, cy + s * 0.6);
      ctx.closePath();
      ctx.fillStyle = "#ffd23a";
      ctx.fill();
      outline(ctx, 2);
    }
  }

  // 특성 표시 (작은 구슬: 재생 초록, 은신 보라, 분열 분홍, 방어 오라 노랑, 면역 하양)
  if (def.traits && def.traits.length > 0) {
    const gap = ts * 0.11;
    const y = sy + r * 0.86 + ts * 0.1;
    def.traits.forEach((tr, i) => {
      ctx.fillStyle =
        tr.type === "regen"
          ? "#7ee35a"
          : tr.type === "stealth"
            ? "#b968ff"
            : tr.type === "split"
              ? "#ff7ab6"
              : tr.type === "aura_defense"
                ? "#ffd23a"
                : "#ffffff";
      ctx.beginPath();
      ctx.arc(sx + (i - (def.traits!.length - 1) / 2) * gap, y, ts * 0.036, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 1.5);
    });
  }
}

/** 위로 솟는 초록 화살표 (버프) */
function drawUpArrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.8, y);
  ctx.lineTo(x + s * 0.32, y);
  ctx.lineTo(x + s * 0.32, y + s * 0.8);
  ctx.lineTo(x - s * 0.32, y + s * 0.8);
  ctx.lineTo(x - s * 0.32, y);
  ctx.lineTo(x - s * 0.8, y);
  ctx.closePath();
  ctx.fillStyle = "#7ee35a";
  ctx.fill();
  outline(ctx, 1.6);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
// 메인
// ------------------------------------------------------------

export function drawGame(ctx: CanvasRenderingContext2D, engine: GameEngine, view: ViewState) {
  const ts = view.tileSize;
  const { map } = engine;
  const now = view.now;
  const cache = view.cache;
  const dt = cache.lastFrame ? Math.min(0.1, (now - cache.lastFrame) / 1000) : 0;
  cache.lastFrame = now;
  cache.frame++;
  const { cols: dCols, rows: dRows } = displaySize(map, view.rotated);
  const W = dCols * ts;
  const H = dRows * ts;
  const S = projector(map, ts, view.rotated);

  ctx.clearRect(0, 0, W, H);

  // 화면 흔들림
  ctx.save();
  if (!view.reducedMotion && now < view.shakeUntil) {
    const m = Math.min(1, (view.shakeUntil - now) / 400) * Math.max(3, ts * 0.08);
    ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
  }

  // ---- 판 ----
  const key = `${map.id}:${map.cols}x${map.rows}:${ts}:${view.rotated}:${view.dpr}:${map.paths.length}`;
  if (!cache.board || cache.board.key !== key) {
    const b = buildBoard(map, ts, view.rotated, view.dpr);
    cache.board = { key, canvas: b.canvas, paths: b.paths };
  }
  ctx.drawImage(cache.board.canvas, 0, 0, W, H);
  drawFlow(ctx, cache.board.paths, ts, now);

  // 출발/도착
  const ends = new Set<string>();
  for (const path of map.paths) {
    if (path.length === 0) continue;
    const s = path[0];
    const e = path[path.length - 1];
    if (!ends.has(`s${s.x},${s.y}`)) {
      ends.add(`s${s.x},${s.y}`);
      const [x, y] = S(s.x, s.y);
      drawPortal(ctx, x, y, ts, now);
    }
    if (!ends.has(`e${e.x},${e.y}`)) {
      ends.add(`e${e.x},${e.y}`);
      const [x, y] = S(e.x, e.y);
      drawGate(ctx, x, y, ts, now);
    }
  }

  const placing = !!(view.placingUid || view.dragUid);

  // 배치 모드: 건설 가능 칸이 하얗게 숨쉼
  if (placing) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (!engine.isTileBuildable(x, y)) continue;
        const [cx, cy] = S(x, y);
        const m = ts * 0.08;
        roundRect(ctx, cx - ts / 2 + m, cy - ts / 2 + m, ts - m * 2, ts - m * 2, ts * 0.16);
        ctx.fillStyle = `rgba(255,255,255,${0.1 + pulse * 0.12})`;
        ctx.fill();
        outline(ctx, 2, `rgba(255,255,255,${0.35 + pulse * 0.3})`);
      }
    }
  }

  // hover 칸
  if (view.hoverTile) {
    const { x, y } = view.hoverTile;
    if (x >= 0 && y >= 0 && x < map.cols && y < map.rows) {
      const [cx, cy] = S(x, y);
      const ok = engine.isTileBuildable(x, y);
      if (view.aimRadius) {
        const r = view.aimRadius * ts;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,157,77,0.22)";
        ctx.fill();
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -now / 40;
        outline(ctx, 6, "rgba(27,20,56,0.6)");
        outline(ctx, 3, "#ff9d4d");
        ctx.setLineDash([]);
        // 과녁 십자
        starPath(ctx, cx, cy, ts * 0.16, ts * 0.05, 4, now / 600);
        ctx.fillStyle = "#ff9d4d";
        ctx.fill();
        outline(ctx, 2);
      } else {
        drawTileCursor(ctx, cx, cy, ts, placing ? (ok ? "#7ee35a" : "#ff6b72") : "#ffffff");
      }

      // 배치/이동 중: 놓을 자리 기준 사거리 미리보기
      const previewUid = view.dragUid ?? view.placingUid;
      const previewUnit = previewUid ? engine.findUnit(previewUid) : undefined;
      const previewDef = previewUnit ? engine.towerDefs.get(previewUnit.defId) : undefined;
      if (previewUnit && previewDef && ok) {
        drawRange(ctx, cx, cy, engine.effectiveRange(previewUnit, previewDef) * ts, "#7ee35a", now);
      }
    }
  }

  // ---- 타워 ----
  const towers = engine.placed
    .filter((t) => t.tile)
    .map((t) => ({ t, def: engine.towerDefs.get(t.defId), pos: S(t.tile!.x, t.tile!.y) }))
    .filter((o): o is { t: TowerUnit; def: TowerDef; pos: [number, number] } => !!o.def)
    .sort((a, b) => a.pos[1] - b.pos[1]);

  // 사거리 (타워 아래에)
  for (const { t, def, pos } of towers) {
    if (view.dragUid === t.uid) continue;
    const hovered =
      !view.dragUid && !view.placingUid && view.hoverTile?.x === t.tile!.x && view.hoverTile?.y === t.tile!.y;
    if (view.selectedUid === t.uid) {
      drawRange(ctx, pos[0], pos[1], engine.effectiveRange(t, def) * ts, "#ffe266", now);
    } else if (hovered) {
      drawRange(ctx, pos[0], pos[1], engine.effectiveRange(t, def) * ts, "#4fe0ff", now, 0.75);
    }
  }

  for (const { t, def, pos } of towers) {
    const [cx, cy] = pos;
    const isDragging = view.dragUid === t.uid;
    const R = ts * 0.4;

    // 합성 후보 / 대상
    if (view.fusionCandidates.has(t.uid) || view.fusionTargetUid === t.uid) {
      const target = view.fusionTargetUid === t.uid;
      const pulse = 0.5 + 0.5 * Math.sin(now / 200);
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8 + pulse * 2, 0, Math.PI * 2);
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -now / 50;
      outline(ctx, 6, "rgba(27,20,56,0.6)");
      outline(ctx, 3, target ? "#ff9d4d" : "#ffe266");
      ctx.setLineDash([]);
    }
    // 선택 고리
    if (view.selectedUid === t.uid && !isDragging) {
      ctx.beginPath();
      ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = now / 45;
      outline(ctx, 6, "rgba(27,20,56,0.6)");
      outline(ctx, 3, "#ffffff");
      ctx.setLineDash([]);
    }

    drawTower(ctx, engine, view, t, def, cx, cy, isDragging ? 0.3 : 1);
    if (isDragging) continue;

    if (def.maxMana > 0) drawManaRing(ctx, cx, cy, R, t.mana / def.maxMana, now);

    // 공속 버프: 위로 솟는 초록 화살표
    if (t.buffs.some((b) => b.until > engine.time)) {
      const k = (now / 700) % 1;
      drawUpArrow(ctx, cx + R * 0.8, cy - R * 0.3 - k * ts * 0.25, ts * 0.09, 1 - k);
    }
  }

  // ---- 적 ----
  const enemies = engine.enemies
    .map((e) => ({ e, pos: S(e.pos.x, e.pos.y) }))
    .sort((a, b) => a.pos[1] - b.pos[1]);
  for (const { e, pos } of enemies) drawEnemy(ctx, engine, view, e, pos[0], pos[1], dt);

  // ---- 투사체: 짧은 꼬리 + 외곽선 두른 구슬 ----
  ctx.save();
  ctx.lineCap = "round";
  for (const p of engine.projectiles) {
    const [cx, cy] = S(p.pos.x, p.pos.y);
    const tr = cache.trails.get(p.uid) ?? [];
    tr.push(cx, cy);
    if (tr.length > 10) tr.splice(0, tr.length - 10);
    cache.trails.set(p.uid, tr);
    const size = p.fromSkill ? 5.5 : p.crit ? 4.6 : 3.6;
    for (let i = 2; i < tr.length; i += 2) {
      const k = i / tr.length;
      ctx.strokeStyle = withAlpha(p.color, 0.6 * k);
      ctx.lineWidth = size * 1.5 * k;
      ctx.beginPath();
      ctx.moveTo(tr[i - 2], tr[i - 1]);
      ctx.lineTo(tr[i], tr[i + 1]);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    outline(ctx, 1.8);
    ctx.beginPath();
    ctx.arc(cx - size * 0.3, cy - size * 0.32, size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
  }
  ctx.restore();

  // ---- 이펙트 ----
  for (const fx of engine.effects) {
    const [cx, cy] = S(fx.pos.x, fx.pos.y);
    const k = Math.min(1, fx.t / fx.duration);
    const seed = hashStr(fx.uid);
    ctx.save();
    switch (fx.kind) {
      case "hit": {
        // 작은 하얀 별 반짝
        const s = ts * 0.17 * (0.5 + easeOutBack(Math.min(1, k * 2.2)) * 0.6);
        ctx.globalAlpha = 1 - k;
        starPath(ctx, cx, cy, s, s * 0.42, 4, seed * 6.28);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        outline(ctx, 1.6);
        break;
      }
      case "crit": {
        // 만화식 "퍽!" 터짐
        const s = ts * 0.4 * (0.4 + easeOutBack(Math.min(1, k * 2.6)) * 0.7);
        ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        starPath(ctx, cx, cy, s, s * 0.58, 9, seed * 6.28);
        ctx.fillStyle = "#ffd23a";
        ctx.fill();
        outline(ctx, 2.5);
        starPath(ctx, cx, cy, s * 0.55, s * 0.32, 9, seed * 6.28 + 0.3);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        break;
      }
      case "aoe": {
        const R = (fx.radius ?? 1.5) * ts;
        const grow = Math.max(1, R * easeOutBack(Math.min(1, k * 2)));
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.arc(cx, cy, grow, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(fx.color, 0.35);
        ctx.fill();
        outline(ctx, 5);
        outline(ctx, 2.5, fx.color);
        // 바깥으로 튀는 조각
        for (let i = 0; i < 8; i++) {
          const a = seed * 6.28 + (i / 8) * Math.PI * 2;
          const d = grow * (0.7 + easeOutCubic(k) * 0.35);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, ts * 0.05 * (1 - k * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = fx.color;
          ctx.fill();
          outline(ctx, 1.5);
        }
        break;
      }
      case "slow": {
        const R = (fx.radius ?? 1.5) * ts;
        const fade = 1 - k;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(165,232,255,0.22)";
        ctx.fill();
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = now / 60;
        outline(ctx, 4, "rgba(27,20,56,0.5)");
        outline(ctx, 2, "#a5e8ff");
        ctx.setLineDash([]);
        // 눈송이
        for (let i = 0; i < 6; i++) {
          const a = now / 900 + (i / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * R * 0.7;
          const py = cy + Math.sin(a) * R * 0.7;
          const s = ts * 0.06;
          ctx.beginPath();
          for (let j = 0; j < 3; j++) {
            const aa = (j / 3) * Math.PI;
            ctx.moveTo(px - Math.cos(aa) * s, py - Math.sin(aa) * s);
            ctx.lineTo(px + Math.cos(aa) * s, py + Math.sin(aa) * s);
          }
          outline(ctx, 3.5);
          outline(ctx, 1.6, "#ffffff");
        }
        break;
      }
      case "stun": {
        ctx.globalAlpha = 1 - k;
        const rr = ts * (0.2 + easeOutCubic(k) * 0.3);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + k * 2;
          starPath(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, ts * 0.07, ts * 0.03, 5, a);
          ctx.fillStyle = "#ffe266";
          ctx.fill();
          outline(ctx, 1.5);
        }
        break;
      }
      case "buff": {
        for (let i = 0; i < 3; i++) {
          const kk = (k + i / 3) % 1;
          drawUpArrow(ctx, cx + (i - 1) * ts * 0.24, cy + ts * 0.25 - kk * ts * 0.7, ts * 0.09, (1 - kk) * 0.95);
        }
        break;
      }
      case "death": {
        // 뿅! 하얀 연기 뭉치 (외곽선을 먼저 깔고 면을 덮어 안쪽 선은 지움)
        const n = 6;
        const puffs: [number, number, number][] = [];
        for (let i = 0; i < n; i++) {
          const a = seed * 6.28 + (i / n) * Math.PI * 2;
          const d = ts * (0.08 + easeOutCubic(k) * 0.26);
          const pr = ts * (0.13 + hash(i, 7, seed * 1000) * 0.05) * (1 - k * 0.7);
          puffs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d - k * ts * 0.18, pr]);
        }
        puffs.push([cx, cy - k * ts * 0.2, ts * 0.17 * (1 - k * 0.8)]);
        ctx.globalAlpha = 1 - k;
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          outline(ctx, 4);
        }
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }
        // 튀는 조각
        for (let i = 0; i < 5; i++) {
          const a = seed * 9 + i * 1.3;
          const d = ts * (0.15 + easeOutCubic(k) * 0.45);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d - k * ts * 0.1, ts * 0.035, 0, Math.PI * 2);
          ctx.fillStyle = fx.color;
          ctx.fill();
          outline(ctx, 1.2);
        }
        break;
      }
      case "skill_text": {
        const text = fx.text ?? "";
        const size = Math.max(11, ts * 0.26);
        ctx.font = `${Math.round(size)}px ${DISPLAY_FONT}`;
        const w = ctx.measureText(text).width + size * 1.2;
        const h = size * 1.6;
        const pop = k < 0.12 ? 0.6 + easeOutBack(k / 0.12) * 0.4 : 1;
        const rise = easeOutCubic(k) * ts * 0.45;
        const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        const y = Math.max(h / 2 + 3, cy - ts * 0.35 - rise);
        // 판 가장자리에서 잘리지 않게
        const x = Math.min(Math.max(cx, w / 2 + 3), W - w / 2 - 3);
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
        ctx.fillStyle = fx.color;
        ctx.fill();
        outline(ctx, 3);
        toonText(ctx, text, 0, 0, size, "#ffffff");
        break;
      }
    }
    ctx.restore();
  }

  // ---- 피해 숫자: 뿅 튀어나왔다가 떠오르며 사라짐 ----
  for (const ft of engine.floatingTexts) {
    const k = Math.min(1, ft.t / ft.duration);
    const [cx, cy0] = S(ft.pos.x, ft.pos.y);
    const pop = k < 0.15 ? 0.5 + easeOutBack(k / 0.15) * 0.8 : 1.3 - Math.min(0.3, (k - 0.15) * 1.2);
    const size = ts * (ft.crit ? 0.4 : 0.26) * pop;
    const cy = cy0 - easeOutCubic(k) * ts * 0.65;
    ctx.save();
    ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
    ctx.translate(cx, cy);
    if (ft.crit) ctx.rotate(-0.14);
    toonText(ctx, ft.crit ? `${ft.text}!` : ft.text, 0, 0, Math.max(9, size), ft.crit ? "#ffd23a" : ft.color);
    ctx.restore();
  }

  // ---- 드래그 고스트 (맨 위) ----
  if (view.dragUid && view.dragPos) {
    const unit = engine.placed.find((t) => t.uid === view.dragUid);
    const def = unit ? engine.towerDefs.get(unit.defId) : undefined;
    if (unit && def) {
      const [gx, gy] = S(view.dragPos.x, view.dragPos.y);
      drawTower(ctx, engine, view, unit, def, gx, gy, 0.9);
    }
  }

  ctx.restore();

  // 캐시 정리 (사라진 유닛/투사체)
  if (cache.frame % 30 === 0) {
    const alive = new Set<string>();
    engine.placed.forEach((t) => t.tile && alive.add(t.uid));
    engine.enemies.forEach((e) => alive.add(e.uid));
    const prune = <T,>(m: Map<string, T>, keep: Set<string>) =>
      Array.from(m.keys()).forEach((id) => keep.has(id) || m.delete(id));
    prune(cache.seen, alive);
    prune(cache.hpTrail, alive);
    prune(cache.facing, alive);
    prune(cache.trails, new Set(engine.projectiles.map((p) => p.uid)));
  }
}
