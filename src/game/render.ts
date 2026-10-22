import { GRADE_BG, GRADE_COLOR, PATH_COLORS } from "./constants";
import type { GameEngine } from "./engine";
import type { Appearance, EnemyUnit, MapDef, Point, TowerDef, TowerUnit } from "./types";

// ============================================================
// 캔버스 렌더러
// - 정적 판(땅/석판/길/바위)은 오프스크린 캔버스에 한 번 그려 재사용
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
const NUM_FONT = '"Gothic A1","Apple SD Gothic Neo",sans-serif';

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
  ctx.font = `${Math.round(size)}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, cx, cy + size * 0.06);
}

// ------------------------------------------------------------
// 정적 판 (오프스크린 캐시)
// ------------------------------------------------------------

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

  // 땅
  const ground = ctx.createLinearGradient(0, 0, 0, H);
  ground.addColorStop(0, "#0e1522");
  ground.addColorStop(1, "#0a0f19");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  const light = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.65);
  light.addColorStop(0, "rgba(120,140,190,0.10)");
  light.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const t = map.tiles[y][x];
      const [cx, cy] = S(x, y);
      const x0 = cx - ts / 2;
      const y0 = cy - ts / 2;
      // 흙 알갱이
      for (let i = 0; i < 4; i++) {
        const hx = hash(x, y, i);
        const hy = hash(y, x, i + 7);
        ctx.fillStyle = `rgba(255,255,255,${0.018 + hash(x, y, i + 3) * 0.02})`;
        ctx.fillRect(x0 + hx * ts, y0 + hy * ts, 1.2, 1.2);
      }
      if (t === "buildable") {
        // 석판
        const m = Math.max(2, ts * 0.06);
        const slab = ctx.createLinearGradient(0, y0, 0, y0 + ts);
        slab.addColorStop(0, mix("#1d283b", "#2a3650", hash(x, y, 11) * 0.6));
        slab.addColorStop(1, "#141c2b");
        roundRect(ctx, x0 + m, y0 + m, ts - m * 2, ts - m * 2, ts * 0.12);
        ctx.fillStyle = slab;
        ctx.fill();
        ctx.strokeStyle = "rgba(230,194,116,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // 윗변 하이라이트 / 아랫변 그림자
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x0 + m + ts * 0.12, y0 + m, ts - m * 2 - ts * 0.24, 1);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x0 + m + ts * 0.1, y0 + ts - m - 1, ts - m * 2 - ts * 0.2, 1);
      } else if (t === "blocked") {
        // 바위
        const pts = 7;
        ctx.beginPath();
        for (let i = 0; i < pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const rr = ts * (0.34 + hash(x, y, i) * 0.12);
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr * 0.85;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const rock = ctx.createLinearGradient(cx, cy - ts * 0.4, cx, cy + ts * 0.4);
        rock.addColorStop(0, "#2a2430");
        rock.addColorStop(1, "#140f16");
        ctx.fillStyle = rock;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.1, cy - ts * 0.15);
        ctx.lineTo(cx + ts * 0.02, cy);
        ctx.lineTo(cx - ts * 0.04, cy + ts * 0.14);
        ctx.stroke();
      }
    }
  }

  // 길: 둥근 이음매로 이어지는 흙길
  const paths: ScreenPath[] = [];
  map.paths.forEach((path, pi) => {
    if (path.length < 2) return;
    const pts = path.map((p) => S(p.x, p.y));
    const acc = [0];
    for (let i = 1; i < pts.length; i++) {
      acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    paths.push({ pts, acc, color: PATH_COLORS[pi % PATH_COLORS.length] });
    const stroke = (w: number, style: string) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.lineWidth = w;
      ctx.strokeStyle = style;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    stroke(ts * 0.98, "rgba(0,0,0,0.55)");
    stroke(ts * 0.86, "#33291c");
    stroke(ts * 0.7, "#3b3020");
    stroke(ts * 0.34, "rgba(255,226,170,0.05)");
  });
  // 길 위 자갈
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] !== "path") continue;
      const [cx, cy] = S(x, y);
      for (let i = 0; i < 3; i++) {
        const px = cx + (hash(x, y, i + 20) - 0.5) * ts * 0.6;
        const py = cy + (hash(x, y, i + 30) - 0.5) * ts * 0.6;
        ctx.beginPath();
        ctx.ellipse(px, py, ts * 0.035, ts * 0.025, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? "rgba(20,15,10,0.55)" : "rgba(120,98,66,0.35)";
        ctx.fill();
      }
    }
  }

  // 가장자리 비네트
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
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
    ctx.strokeStyle = withAlpha(p.color, 0.2);
    ctx.lineWidth = Math.max(1.5, ts * 0.045);
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
      const s = ts * 0.11;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s);
      ctx.lineTo(x, y);
      ctx.lineTo(x + Math.cos(a - 2.4) * s, y + Math.sin(a - 2.4) * s);
      ctx.stroke();
    }
  }
}

/** 출발지: 보랏빛 소용돌이 포탈 */
function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, now: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, ts * 0.75);
  glow.addColorStop(0, "rgba(196,161,255,0.55)");
  glow.addColorStop(0.5, "rgba(124,58,237,0.18)");
  glow.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, ts * 0.75, 0, Math.PI * 2);
  ctx.fill();
  const a = now / 700;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, ts * 0.05);
  ctx.strokeStyle = "rgba(216,196,255,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, ts * 0.32, a, a + Math.PI * 1.25);
  ctx.stroke();
  ctx.strokeStyle = "rgba(167,139,250,0.75)";
  ctx.beginPath();
  ctx.arc(x, y, ts * 0.21, -a * 1.4, -a * 1.4 + Math.PI * 1.1);
  ctx.stroke();
  ctx.fillStyle = "#1a0f33";
  ctx.beginPath();
  ctx.arc(x, y, ts * 0.11, 0, Math.PI * 2);
  ctx.fill();
}

/** 도착지: 금빛 방패 문장 */
function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, now: number) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 600);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, ts * 0.7);
  glow.addColorStop(0, `rgba(243,220,156,${0.25 + pulse * 0.15})`);
  glow.addColorStop(1, "rgba(243,220,156,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, ts * 0.7, 0, Math.PI * 2);
  ctx.fill();
  const s = ts * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.85, y - s * 0.62);
  ctx.lineTo(x + s * 0.85, y + s * 0.05);
  ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.75, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.75, x - s * 0.85, y + s * 0.05);
  ctx.lineTo(x - s * 0.85, y - s * 0.62);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, y - s, x, y + s);
  g.addColorStop(0, "#f6e3ad");
  g.addColorStop(1, "#8a6424");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(5,7,11,0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(5,7,11,0.35)";
  ctx.fillRect(x - 0.75, y - s * 0.7, 1.5, s * 1.4);
}

/** 네 귀퉁이 꺾쇠로 칸 표시 */
function drawBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, ts: number, color: string) {
  const m = ts * 0.06;
  const l = ts * 0.24;
  const x0 = x - ts / 2 + m;
  const y0 = y - ts / 2 + m;
  const x1 = x + ts / 2 - m;
  const y1 = y + ts / 2 - m;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0 + l);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + l, y0);
  ctx.moveTo(x1 - l, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + l);
  ctx.moveTo(x1, y1 - l);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - l, y1);
  ctx.moveTo(x0 + l, y1);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y1 - l);
  ctx.stroke();
}

/** 사거리 원: 안쪽은 투명, 가장자리로 갈수록 진해지는 채움 + 도는 점선 */
function drawRange(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  now: number,
  strength = 1
) {
  const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(1, withAlpha(color, 0.14 * strength));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -now / 60;
  ctx.strokeStyle = withAlpha(color, 0.65 * strength);
  ctx.lineWidth = 1.5;
  ctx.stroke();
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
  const color = GRADE_COLOR[def.grade];
  const [bg0, bg1] = GRADE_BG[def.grade];

  // 등장 연출: 작게 튀어나오며 커짐
  let seen = view.cache.seen.get(t.uid);
  if (seen === undefined) {
    seen = now;
    view.cache.seen.set(t.uid, now);
  }
  const age = now - seen;
  const appear = Math.min(1, age / 320);
  const scale = appear < 1 ? 0.55 + 0.45 * easeOutBack(appear) : 1;

  const a = screenAngle(t.aimAngle, view.rotated);
  const recoil = t.attackAnim * ts * 0.12;
  const ax = sx + Math.cos(a) * recoil;
  const ay = sy + Math.sin(a) * recoil;

  ctx.save();
  ctx.globalAlpha = alpha * Math.min(1, appear * 1.6);
  ctx.translate(ax, ay);
  ctx.scale(scale, scale);

  // 그림자
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, R * 0.62, R * 0.92, R * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // 받침: 등급 그라데이션 + 등급색 테두리
  const ped = ctx.createLinearGradient(-R, -R, R, R);
  ped.addColorStop(0, bg1);
  ped.addColorStop(1, bg0);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = ped;
  ctx.fill();
  if (def.grade === "legendary" || def.grade === "hero") {
    ctx.shadowColor = color;
    ctx.shadowBlur = def.grade === "legendary" ? 12 + 4 * Math.sin(now / 300) : 6;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = t.attackAnim > 0.5 ? 3 : 2;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, R - 3, 0, Math.PI * 2);
  ctx.stroke();

  // 지역색 안쪽 빛
  const tint = ctx.createRadialGradient(0, -R * 0.3, 0, 0, 0, R * 0.85);
  tint.addColorStop(0, withAlpha(def.appearance.color, 0.35));
  tint.addColorStop(1, withAlpha(def.appearance.color, 0));
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // 스킬 발동 섬광
  if (t.skillAnimUntil > engine.time) {
    const k = Math.max(0, 1 - (t.skillAnimUntil - engine.time) / 0.6);
    const fr = R * (1.2 + k);
    const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, fr);
    flash.addColorStop(0, withAlpha(color, 0.55 * (1 - k)));
    flash.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(0, 0, fr, 0, Math.PI * 2);
    ctx.fill();
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
  const bob = Math.sin(now / 520 + hashStr(t.uid) * 6.28) * ts * 0.02;
  if (!drawImageApp(ctx, def.appearance, 0, -R * 0.12 + bob, ts * 0.32, view, anim)) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    drawEmoji(ctx, def.appearance.icon, 0, -R * 0.04 + bob, R * 1.15);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();

  // 등장 고리
  if (age < 420) {
    const k = age / 420;
    ctx.strokeStyle = withAlpha(color, 1 - k);
    ctx.lineWidth = 2.5 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, R * (1 + k * 0.9), 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** 받침 둘레의 마나 고리 */
function drawManaRing(ctx: CanvasRenderingContext2D, sx: number, sy: number, R: number, ratio: number) {
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(5,7,11,0.6)";
  ctx.beginPath();
  ctx.arc(sx, sy, R + 3, 0, Math.PI * 2);
  ctx.stroke();
  if (ratio <= 0) return;
  ctx.strokeStyle = ratio >= 0.999 ? "#b6fbf6" : "#5ee8e0";
  ctx.beginPath();
  ctx.arc(sx, sy, R + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
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

  const stunned = e.stunUntil > engine.time;
  const bob = stunned ? 0 : Math.abs(Math.sin(now / 130 + h * 6.28)) * r * 0.1;
  const by = sy - bob;

  ctx.save();
  ctx.globalAlpha = appear;

  // 그림자
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + r * 0.82, r * (0.85 - bob / r), r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // 보스 기운
  if (e.isBoss) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const aura = ctx.createRadialGradient(sx, by, r * 0.4, sx, by, r * 1.7);
    aura.addColorStop(0, `rgba(229,72,77,${0.25 + pulse * 0.15})`);
    aura.addColorStop(1, "rgba(229,72,77,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(sx, by, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const stealth = def.traits?.some((tr) => tr.type === "stealth");
  if (stealth) ctx.globalAlpha = appear * (0.45 + 0.1 * Math.sin(now / 200 + h * 6));

  const anim: AnimState = { name: "walk", t: engine.time, facing };
  if (!drawImageApp(ctx, def.appearance, sx, by, r, view, anim)) {
    shapePath(ctx, def.appearance.shape, sx, by, r);
    const body = ctx.createRadialGradient(sx - r * 0.35, by - r * 0.45, r * 0.1, sx, by, r * 1.1);
    body.addColorStop(0, mix(def.appearance.color, "#ffffff", 0.35));
    body.addColorStop(0.55, def.appearance.color);
    body.addColorStop(1, mix(def.appearance.color, "#000000", 0.45));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = "rgba(5,7,11,0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 피격 섬광
    if (e.hitFlashUntil > engine.time) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.min(1, (e.hitFlashUntil - engine.time) / 0.12)})`;
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

  // 둔화: 서리 고리
  if (e.slowUntil > engine.time) {
    ctx.strokeStyle = "rgba(125,211,252,0.75)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.lineDashOffset = now / 50;
    ctx.beginPath();
    ctx.arc(sx, by, r + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // 기절: 머리 위를 도는 별
  if (stunned) {
    for (let i = 0; i < 3; i++) {
      const ang = now / 220 + (i * Math.PI * 2) / 3;
      const px = sx + Math.cos(ang) * r * 0.7;
      const py = by - r - ts * 0.06 + Math.sin(ang) * r * 0.22;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const rr = j % 2 === 0 ? ts * 0.06 : ts * 0.025;
        const aa = (Math.PI / 4) * j;
        if (j === 0) ctx.moveTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
        else ctx.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // 체력 바 (보스는 항상, 일반 적은 피해를 입은 뒤부터) + 깎인 만큼 하얗게 남는 잔상
  const ratio = Math.max(0, e.hp / e.maxHp);
  let trail = view.cache.hpTrail.get(e.uid) ?? ratio;
  trail = Math.max(ratio, trail - dt * 0.9);
  view.cache.hpTrail.set(e.uid, trail);
  if (e.isBoss || ratio < 0.999) {
    const w = e.isBoss ? ts * 1.15 : ts * 0.62;
    const hgt = e.isBoss ? 5 : 3.5;
    const x = sx - w / 2;
    const y = by - r - (e.isBoss ? 12 : 8);
    roundRect(ctx, x - 1, y - 1, w + 2, hgt + 2, 2.5);
    ctx.fillStyle = "rgba(5,7,11,0.8)";
    ctx.fill();
    if (trail > ratio) {
      ctx.fillStyle = "rgba(255,236,210,0.75)";
      ctx.fillRect(x, y, w * trail, hgt);
    }
    ctx.fillStyle = e.isBoss ? "#ff5a5f" : ratio > 0.5 ? "#7ee0a6" : ratio > 0.25 ? "#f5c451" : "#ff6b6b";
    ctx.fillRect(x, y, w * ratio, hgt);
    if (e.isBoss) {
      // 왕관
      const cx = sx;
      const cy = y - ts * 0.12;
      const s = ts * 0.1;
      ctx.fillStyle = "#f3dc9c";
      ctx.beginPath();
      ctx.moveTo(cx - s, cy + s * 0.6);
      ctx.lineTo(cx - s, cy - s * 0.3);
      ctx.lineTo(cx - s * 0.45, cy + s * 0.1);
      ctx.lineTo(cx, cy - s * 0.6);
      ctx.lineTo(cx + s * 0.45, cy + s * 0.1);
      ctx.lineTo(cx + s, cy - s * 0.3);
      ctx.lineTo(cx + s, cy + s * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 특성 표시 (작은 점: 재생 초록, 은신 보라, 분열 분홍, 방어 오라 금색, 면역 하양)
  if (def.traits && def.traits.length > 0) {
    const gap = ts * 0.09;
    const y = sy + r * 0.82 + ts * 0.1;
    def.traits.forEach((tr, i) => {
      ctx.fillStyle =
        tr.type === "regen"
          ? "#7ee0a6"
          : tr.type === "stealth"
            ? "#c4a1ff"
            : tr.type === "split"
              ? "#f472b6"
              : tr.type === "aura_defense"
                ? "#e6c274"
                : "#e2e8f0";
      ctx.beginPath();
      ctx.arc(sx + (i - (def.traits!.length - 1) / 2) * gap, y, ts * 0.028, 0, Math.PI * 2);
      ctx.fill();
    });
  }
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

  // 배치 모드: 건설 가능 칸이 은은하게 숨쉼
  if (placing) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 280);
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (!engine.isTileBuildable(x, y)) continue;
        const [cx, cy] = S(x, y);
        const m = ts * 0.08;
        roundRect(ctx, cx - ts / 2 + m, cy - ts / 2 + m, ts - m * 2, ts - m * 2, ts * 0.12);
        ctx.fillStyle = `rgba(126,224,166,${0.07 + pulse * 0.06})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(126,224,166,${0.18 + pulse * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
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
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(255,157,77,0.05)");
        g.addColorStop(1, "rgba(255,157,77,0.22)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -now / 40;
        ctx.strokeStyle = "rgba(255,178,122,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        drawBrackets(
          ctx,
          cx,
          cy,
          ts,
          placing ? (ok ? "rgba(126,224,166,0.95)" : "rgba(255,107,107,0.85)") : "rgba(230,194,116,0.55)"
        );
      }

      // 배치/이동 중: 놓을 자리 기준 사거리 미리보기
      const previewUid = view.dragUid ?? view.placingUid;
      const previewUnit = previewUid ? engine.findUnit(previewUid) : undefined;
      const previewDef = previewUnit ? engine.towerDefs.get(previewUnit.defId) : undefined;
      if (previewUnit && previewDef && ok) {
        drawRange(ctx, cx, cy, engine.effectiveRange(previewUnit, previewDef) * ts, "#7ee0a6", now);
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
      drawRange(ctx, pos[0], pos[1], engine.effectiveRange(t, def) * ts, "#e6c274", now);
    } else if (hovered) {
      drawRange(ctx, pos[0], pos[1], engine.effectiveRange(t, def) * ts, "#5ee8e0", now, 0.7);
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
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -now / 50;
      ctx.strokeStyle = target ? "#ff9d4d" : `rgba(243,220,156,${0.55 + pulse * 0.4})`;
      ctx.lineWidth = target ? 3 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 선택 고리
    if (view.selectedUid === t.uid && !isDragging) {
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = now / 45;
      ctx.strokeStyle = "rgba(243,220,156,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawTower(ctx, engine, view, t, def, cx, cy, isDragging ? 0.3 : 1);
    if (isDragging) continue;

    if (def.maxMana > 0) drawManaRing(ctx, cx, cy, R, t.mana / def.maxMana);

    // 공속 버프: 위로 솟는 초록 화살표
    if (t.buffs.some((b) => b.until > engine.time)) {
      const k = (now / 600) % 1;
      ctx.strokeStyle = `rgba(126,224,166,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const bx = cx + R * 0.75;
      const by = cy - R * 0.4 - k * ts * 0.25;
      ctx.moveTo(bx - ts * 0.07, by + ts * 0.05);
      ctx.lineTo(bx, by - ts * 0.02);
      ctx.lineTo(bx + ts * 0.07, by + ts * 0.05);
      ctx.stroke();
    }
  }

  // ---- 적 ----
  const enemies = engine.enemies
    .map((e) => ({ e, pos: S(e.pos.x, e.pos.y) }))
    .sort((a, b) => a.pos[1] - b.pos[1]);
  for (const { e, pos } of enemies) drawEnemy(ctx, engine, view, e, pos[0], pos[1], dt);

  // ---- 투사체 (잔상 + 빛나는 머리) ----
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const p of engine.projectiles) {
    const [cx, cy] = S(p.pos.x, p.pos.y);
    const tr = cache.trails.get(p.uid) ?? [];
    tr.push(cx, cy);
    if (tr.length > 12) tr.splice(0, tr.length - 12);
    cache.trails.set(p.uid, tr);
    const size = p.fromSkill ? 4.5 : p.crit ? 3.6 : 2.6;
    for (let i = 2; i < tr.length; i += 2) {
      const k = i / tr.length;
      ctx.strokeStyle = withAlpha(p.color, 0.5 * k);
      ctx.lineWidth = size * 1.6 * k;
      ctx.beginPath();
      ctx.moveTo(tr[i - 2], tr[i - 1]);
      ctx.lineTo(tr[i], tr[i + 1]);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 3);
    glow.addColorStop(0, "rgba(255,255,255,0.9)");
    glow.addColorStop(0.35, withAlpha(p.color, 0.9));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ---- 이펙트 ----
  for (const fx of engine.effects) {
    const [cx, cy] = S(fx.pos.x, fx.pos.y);
    const k = Math.min(1, fx.t / fx.duration);
    const seed = hashStr(fx.uid);
    switch (fx.kind) {
      case "hit":
      case "crit": {
        const crit = fx.kind === "crit";
        const rr = ts * (crit ? 0.46 : 0.26) * (0.45 + easeOutCubic(k) * 0.75);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = withAlpha(fx.color, 1 - k);
        ctx.lineWidth = crit ? 2.5 : 1.8;
        ctx.lineCap = "round";
        const n = crit ? 8 : 5;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = seed * 6.28 + (i / n) * Math.PI * 2;
          ctx.moveTo(cx + Math.cos(a) * rr * 0.45, cy + Math.sin(a) * rr * 0.45);
          ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        ctx.stroke();
        if (crit) {
          ctx.strokeStyle = `rgba(255,215,106,${0.8 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, rr * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "aoe": {
        const R = (fx.radius ?? 1.5) * ts;
        const grow = Math.max(1, R * easeOutCubic(Math.min(1, k * 1.7)));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, grow);
        g.addColorStop(0, withAlpha(fx.color, 0.05 * (1 - k)));
        g.addColorStop(1, withAlpha(fx.color, 0.4 * (1 - k)));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, grow, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(fx.color, 0.9 * (1 - k));
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, grow * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "slow": {
        const R = (fx.radius ?? 1.5) * ts;
        const fade = 1 - k;
        ctx.fillStyle = `rgba(125,211,252,${0.1 * fade})`;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.setLineDash([3, 6]);
        ctx.lineDashOffset = now / 60;
        ctx.strokeStyle = `rgba(186,230,253,${0.5 * fade})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 6; i++) {
          const a = now / 900 + (i / 6) * Math.PI * 2;
          ctx.fillStyle = `rgba(224,242,254,${0.7 * fade})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "stun": {
        ctx.strokeStyle = `rgba(253,230,138,${0.9 * (1 - k)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, ts * (0.2 + k * 0.35), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "buff": {
        for (let i = 0; i < 3; i++) {
          const kk = (k + i / 3) % 1;
          const bx = cx + (i - 1) * ts * 0.22;
          const by = cy + ts * 0.25 - kk * ts * 0.7;
          ctx.strokeStyle = `rgba(126,224,166,${(1 - kk) * 0.9})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - ts * 0.08, by + ts * 0.06);
          ctx.lineTo(bx, by - ts * 0.02);
          ctx.lineTo(bx + ts * 0.08, by + ts * 0.06);
          ctx.stroke();
        }
        break;
      }
      case "death": {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (k < 0.25) {
          ctx.fillStyle = `rgba(255,240,220,${0.5 * (1 - k / 0.25)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, ts * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = seed * 6.28 + (i / n) * Math.PI * 2 + hash(i, 3, seed * 1000) * 0.6;
          const d = ts * (0.12 + easeOutCubic(k) * (0.4 + hash(i, 7, seed * 1000) * 0.3));
          ctx.fillStyle = withAlpha(fx.color, 1 - k);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d - k * ts * 0.1, 2.4 * (1 - k) + 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case "skill_text": {
        const text = fx.text ?? "";
        const size = Math.max(10, ts * 0.24);
        ctx.font = `800 ${size}px ${NUM_FONT}`;
        const w = ctx.measureText(text).width + size * 1.1;
        const h = size * 1.55;
        const rise = easeOutCubic(k) * ts * 0.5;
        const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : Math.min(1, k * 6);
        const y = Math.max(h / 2 + 2, cy - ts * 0.3 - rise);
        // 판 가장자리에서 잘리지 않게
        const x = Math.min(Math.max(cx, w / 2 + 2), W - w / 2 - 2);
        ctx.save();
        ctx.globalAlpha = alpha;
        roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
        ctx.fillStyle = "rgba(5,7,11,0.82)";
        ctx.fill();
        ctx.strokeStyle = withAlpha(fx.color, 0.8);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = fx.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y + 0.5);
        ctx.restore();
        break;
      }
    }
  }

  // ---- 피해 숫자: 튀어나왔다가 떠오르며 사라짐 ----
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const ft of engine.floatingTexts) {
    const k = Math.min(1, ft.t / ft.duration);
    const [cx, cy0] = S(ft.pos.x, ft.pos.y);
    const pop = k < 0.12 ? 0.55 + (k / 0.12) * 0.75 : 1.3 - Math.min(0.3, (k - 0.12) * 1.6);
    const size = ts * (ft.crit ? 0.36 : 0.24) * pop;
    const cy = cy0 - easeOutCubic(k) * ts * 0.7;
    ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    ctx.font = `800 ${Math.max(8, size)}px ${NUM_FONT}`;
    const text = ft.crit ? `${ft.text}!` : ft.text;
    ctx.lineWidth = Math.max(2.5, size * 0.2);
    ctx.strokeStyle = "rgba(5,7,11,0.85)";
    ctx.strokeText(text, cx, cy);
    if (ft.crit) {
      ctx.shadowColor = "rgba(255,180,60,0.9)";
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = ft.color;
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  ctx.globalAlpha = 1;

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
