import type { SpriteAnim, SpriteSheet } from "@/game/types";

/**
 * scripts/fix_sprite_sheet.py 출력(JSON)을 외형 설정으로 변환
 * - 시트 모드 출력의 { sprite: {...} } 또는 sprite 객체 자체 → sprite
 * - --single 출력의 { image: "/characters/x.png" } → image
 * - 출력 뒤에 붙는 안내 문장("참고: …")까지 통째로 붙여넣어도 첫 JSON 객체만 읽음
 */
export type FixerImport = { sprite: SpriteSheet } | { image: string } | { error: string };

const ANIMS = ["idle", "attack", "skill", "walk", "death"] as const;

function firstJsonObject(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    // 앞뒤 안내 문장이 섞인 경우: 첫 { 부터 짝이 맞는 } 까지
    const start = t.indexOf("{");
    if (start < 0) throw new Error("JSON을 찾지 못했습니다");
    let depth = 0;
    let inStr = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (c === "\\") i++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return JSON.parse(t.slice(start, i + 1));
    }
    throw new Error("JSON이 중간에 끊겼습니다");
  }
}

const isPos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

function toAnim(v: unknown): SpriteAnim | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (typeof a.row !== "number" || a.row < 0 || !isPos(a.frames) || !isPos(a.fps)) return null;
  return { row: a.row, frames: a.frames, fps: a.fps };
}

export function parseFixerOutput(text: string): FixerImport {
  let obj: unknown;
  try {
    obj = firstJsonObject(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "JSON 형식이 아닙니다" };
  }
  if (!obj || typeof obj !== "object") return { error: "JSON 객체가 아닙니다" };
  const o = obj as Record<string, unknown>;

  const raw = (o.sprite && typeof o.sprite === "object" ? o.sprite : "frameWidth" in o ? o : null) as Record<
    string,
    unknown
  > | null;
  if (raw) {
    if (typeof raw.src !== "string" || !raw.src) return { error: "sprite.src(시트 경로)가 없습니다" };
    if (!isPos(raw.frameWidth) || !isPos(raw.frameHeight)) return { error: "프레임 크기가 올바르지 않습니다" };
    const animsIn = (raw.animations ?? {}) as Record<string, unknown>;
    const idle = toAnim(animsIn.idle);
    if (!idle) return { error: "idle 애니메이션이 없습니다" };
    const animations: SpriteSheet["animations"] = { idle };
    for (const k of ANIMS) {
      if (k === "idle") continue;
      const a = toAnim(animsIn[k]);
      if (a) animations[k] = a;
    }
    return {
      sprite: {
        src: raw.src,
        frameWidth: raw.frameWidth,
        frameHeight: raw.frameHeight,
        scale: isPos(raw.scale) ? raw.scale : 1,
        facing: raw.facing === "left" ? "left" : "right",
        animations,
      },
    };
  }
  if (typeof o.image === "string" && o.image) return { image: o.image };
  return { error: "sprite 또는 image 항목이 없습니다 (fix_sprite_sheet.py 출력을 붙여넣으세요)" };
}
