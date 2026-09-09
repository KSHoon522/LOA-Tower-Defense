import { GRADE_COLOR, PATH_COLORS } from "./constants";
import type { GameEngine } from "./engine";
import type { Appearance, Point } from "./types";

export interface ViewState {
  tileSize: number;
  selectedUid: string | null;
  /** 배치 대기 중인 대기석 유닛 (선택된 대기석 유닛) */
  placingUid: string | null;
  hoverTile: Point | null;
  /** 드래그 중인 배치 타워 */
  dragUid: string | null;
  /** 드래그 현재 위치 (타일 좌표, 소수) */
  dragPos: Point | null;
  /** 합성 가능 후보 (선택 유닛과 같은 등급) */
  fusionCandidates: Set<string>;
  fusionTargetUid: string | null;
  /** 직업 스킬 조준 모드: 반경 (타일) */
  aimRadius: number | null;
  /** 이미지 캐시 (appearance.image 경로 → HTMLImageElement) */
  imageCache: Map<string, HTMLImageElement>;
}

export function createViewState(tileSize: number): ViewState {
  return {
    tileSize,
    selectedUid: null,
    placingUid: null,
    hoverTile: null,
    dragUid: null,
    dragPos: null,
    fusionCandidates: new Set(),
    fusionTargetUid: null,
    aimRadius: null,
    imageCache: new Map(),
  };
}

function px(v: number, ts: number): number {
  return (v + 0.5) * ts;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  app: Appearance,
  cx: number,
  cy: number,
  r: number,
  view: ViewState
) {
  // 이미지가 있으면 이미지 우선 (추후 카툰 그래픽 교체 지점)
  if (app.image) {
    let img = view.imageCache.get(app.image);
    if (!img) {
      img = new Image();
      img.src = app.image;
      view.imageCache.set(app.image, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      return;
    }
  }

  ctx.fillStyle = app.color;
  ctx.beginPath();
  switch (app.shape) {
    case "circle":
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.9, cy + r * 0.75);
      ctx.lineTo(cx - r * 0.9, cy + r * 0.75);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      break;
    case "star": {
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
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
  ctx.fill();

  // 이모지 아이콘
  if (app.icon) {
    ctx.font = `${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(app.icon, cx, cy + 1);
  }
}

const TILE_FILL: Record<string, string> = {
  empty: "#0b1220",
  buildable: "#16233a",
  path: "#3b3325",
  blocked: "#1c1017",
};

function drawTowerAt(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  view: ViewState,
  uid: string,
  cx: number,
  cy: number,
  alpha = 1
) {
  const unit = engine.placed.find((t) => t.uid === uid);
  if (!unit) return;
  const def = engine.towerDefs.get(unit.defId);
  if (!def) return;
  const ts = view.tileSize;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, ts * 0.42, 0, Math.PI * 2);
  ctx.strokeStyle = GRADE_COLOR[def.grade];
  ctx.lineWidth = 2;
  ctx.stroke();
  drawShape(ctx, def.appearance, cx, cy, ts * 0.32, view);
  ctx.globalAlpha = 1;
}

export function drawGame(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  view: ViewState
) {
  const ts = view.tileSize;
  const { map } = engine;
  ctx.clearRect(0, 0, map.cols * ts, map.rows * ts);

  // ---- 타일 ----
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      const t = map.tiles[y][x];
      ctx.fillStyle = TILE_FILL[t] ?? TILE_FILL.empty;
      ctx.fillRect(x * ts, y * ts, ts - 1, ts - 1);
    }
  }

  // 배치/드래그 모드: 건설 가능 타일 하이라이트
  if (view.placingUid || view.dragUid) {
    ctx.fillStyle = "rgba(74, 222, 128, 0.15)";
    for (let y = 0; y < map.rows; y++) {
      for (let x = 0; x < map.cols; x++) {
        if (engine.isTileBuildable(x, y)) ctx.fillRect(x * ts, y * ts, ts - 1, ts - 1);
      }
    }
  }

  // ---- 경로 표시 (다중 경로: 경로별 색상) ----
  map.paths.forEach((path, pi) => {
    if (path.length === 0) return;
    const color = PATH_COLORS[pi % PATH_COLORS.length];

    // 경로 라인 (은은하게)
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 3;
    ctx.beginPath();
    path.forEach((p, i) => {
      const cx = px(p.x, ts);
      const cy = px(p.y, ts);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    const start = path[0];
    const end = path[path.length - 1];
    ctx.font = `${ts * 0.5}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🚩", px(start.x, ts), px(start.y, ts));
    ctx.fillText("🏰", px(end.x, ts), px(end.y, ts));
  });

  // hover 타일
  if (view.hoverTile) {
    const { x, y } = view.hoverTile;
    const placing = view.placingUid || view.dragUid;
    ctx.strokeStyle = placing && engine.isTileBuildable(x, y) ? "#4ade80" : "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 3, ts - 3);

    // 직업 스킬 조준: 반경 미리보기
    if (view.aimRadius) {
      ctx.beginPath();
      ctx.arc(px(x, ts), px(y, ts), view.aimRadius * ts, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(249, 115, 22, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ---- 타워 ----
  for (const t of engine.placed) {
    if (!t.tile) continue;
    const def = engine.towerDefs.get(t.defId);
    if (!def) continue;
    const isDragging = view.dragUid === t.uid;
    const cx = px(t.tile.x, ts);
    const cy = px(t.tile.y, ts);

    // 선택 시 사거리 표시
    if (view.selectedUid === t.uid && !isDragging) {
      ctx.beginPath();
      ctx.arc(cx, cy, engine.effectiveRange(t, def) * ts, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 합성 후보/대상 하이라이트 (점선 링)
    if (view.fusionCandidates.has(t.uid) || view.fusionTargetUid === t.uid) {
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.5, 0, Math.PI * 2);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = view.fusionTargetUid === t.uid ? "#f97316" : "#fbbf24";
      ctx.lineWidth = view.fusionTargetUid === t.uid ? 3 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 공격 모션: 조준 방향으로 살짝 튀어나갔다 복귀 (recoil)
    const recoil = t.attackAnim * ts * 0.15;
    const ax = cx + Math.cos(t.aimAngle) * recoil;
    const ay = cy + Math.sin(t.aimAngle) * recoil;

    ctx.globalAlpha = isDragging ? 0.35 : 1;

    // 등급 테두리
    ctx.beginPath();
    ctx.arc(ax, ay, ts * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = GRADE_COLOR[def.grade];
    ctx.lineWidth = t.attackAnim > 0.5 ? 3.5 : 2;
    ctx.stroke();

    drawShape(ctx, def.appearance, ax, ay, ts * 0.32, view);
    ctx.globalAlpha = 1;

    if (isDragging) continue;

    // 마나 바
    if (def.maxMana > 0) {
      const w = ts * 0.7;
      const ratio = Math.min(1, t.mana / def.maxMana);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(cx - w / 2, cy + ts * 0.36, w, 3);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(cx - w / 2, cy + ts * 0.36, w * ratio, 3);
    }

    // 버프 표시
    if (t.buffs.some((b) => b.until > engine.time)) {
      ctx.font = `${ts * 0.28}px sans-serif`;
      ctx.fillText("⚡", cx + ts * 0.3, cy - ts * 0.3);
    }
  }

  // ---- 적 ----
  for (const e of engine.enemies) {
    const def = engine.enemyDefs.get(e.defId);
    if (!def) continue;
    const cx = px(e.pos.x, ts);
    const cy = px(e.pos.y, ts);
    const r = e.isBoss ? ts * 0.42 : ts * 0.28;

    // 피격 플래시
    if (e.hitFlashUntil > engine.time) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    }

    drawShape(ctx, def.appearance, cx, cy, r, view);

    // 상태이상 표시
    if (e.stunUntil > engine.time) {
      ctx.font = `${ts * 0.3}px sans-serif`;
      ctx.fillText("💫", cx, cy - r - ts * 0.15);
    } else if (e.slowUntil > engine.time) {
      ctx.font = `${ts * 0.25}px sans-serif`;
      ctx.fillText("🧊", cx + r * 0.8, cy - r * 0.8);
    }

    // HP 바
    const w = e.isBoss ? ts * 1.2 : ts * 0.6;
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(cx - w / 2, cy - r - 7, w, e.isBoss ? 5 : 4);
    ctx.fillStyle = e.isBoss ? "#f87171" : ratio > 0.4 ? "#4ade80" : "#facc15";
    ctx.fillRect(cx - w / 2, cy - r - 7, w * ratio, e.isBoss ? 5 : 4);
  }

  // ---- 투사체 ----
  for (const p of engine.projectiles) {
    const cx = px(p.pos.x, ts);
    const cy = px(p.pos.y, ts);
    ctx.beginPath();
    ctx.arc(cx, cy, p.fromSkill ? 6 : p.crit ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.fromSkill ? 12 : 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ---- 이펙트 ----
  for (const fx of engine.effects) {
    const cx = px(fx.pos.x, ts);
    const cy = px(fx.pos.y, ts);
    const progress = fx.t / fx.duration;

    switch (fx.kind) {
      case "hit":
      case "crit": {
        const r = (fx.kind === "crit" ? 0.5 : 0.3) * ts * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = fx.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = fx.kind === "crit" ? 3 : 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "aoe": {
        const r = (fx.radius ?? 1.5) * ts * Math.min(1, progress * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fx.color;
        ctx.globalAlpha = 0.35 * (1 - progress);
        ctx.fill();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "slow": {
        const r = (fx.radius ?? 1.5) * ts;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = fx.color;
        ctx.globalAlpha = 0.12 * (1 - progress);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case "stun":
      case "buff": {
        ctx.font = `${ts * 0.4}px sans-serif`;
        ctx.textAlign = "center";
        ctx.globalAlpha = 1 - progress;
        ctx.fillText(fx.kind === "stun" ? "💫" : "⬆️", cx, cy - ts * 0.5);
        ctx.globalAlpha = 1;
        break;
      }
      case "death": {
        const r = ts * 0.4 * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = fx.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case "skill_text": {
        ctx.font = `bold ${ts * 0.3}px sans-serif`;
        ctx.textAlign = "center";
        ctx.globalAlpha = 1 - progress;
        ctx.fillStyle = fx.color;
        ctx.fillText(fx.text ?? "", cx, cy - progress * ts * 0.5);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  // ---- 데미지 텍스트 ----
  for (const ft of engine.floatingTexts) {
    const progress = ft.t / ft.duration;
    const cx = px(ft.pos.x, ts);
    const cy = px(ft.pos.y, ts) - progress * ts * 0.7;
    ctx.font = `${ft.crit ? "bold " : ""}${ts * (ft.crit ? 0.34 : 0.26)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.crit ? `${ft.text}!` : ft.text, cx, cy);
    ctx.globalAlpha = 1;
  }

  // ---- 드래그 고스트 (맨 위) ----
  if (view.dragUid && view.dragPos) {
    drawTowerAt(ctx, engine, view, view.dragUid, px(view.dragPos.x - 0.5, ts), px(view.dragPos.y - 0.5, ts), 0.85);
  }
}
