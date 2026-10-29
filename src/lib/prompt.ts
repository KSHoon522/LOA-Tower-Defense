import type { Grade } from "@/game/types";

/**
 * 이미지 생성 프롬프트 조합기
 * = 공통 스타일(카봇풍) + 캐릭터 고유 외형(artRef) + 등급/역할 키워드
 * docs/image-prompts.md, docs/character-references.md 와 규칙을 맞춘다.
 */

export const STYLE_BASE =
  "chibi cartoon game character in Carbot Animations style, thick black outlines, " +
  "flat cel shading, oversized head, tiny body, exaggerated cute proportions, " +
  "simple geometric shapes, vibrant saturated colors, white background, game asset, " +
  "centered, full body";

/** 빼고 싶은 요소 (도구마다 쓰는 형식이 다름) */
export const NEGATIVE_TERMS = "realistic, photorealistic, 3d render, gradient shading, text, watermark, extra limbs";

/** Midjourney 형식 */
export const STYLE_NEGATIVE = `--no ${NEGATIVE_TERMS}`;

/** Gemini·ChatGPT처럼 문장으로 받는 도구 형식 (--no 문법을 모름) */
export const STYLE_AVOID = `Avoid: ${NEGATIVE_TERMS}.`;

/** 카드 일러스트를 참조 이미지로 첨부할 때 붙이는 문장 — 외형만 따르고 배경·화풍은 따르지 않게 */
export const REFERENCE_LINE =
  "use the attached card illustration only as a reference for the character's face, hair, outfit and colors; " +
  "ignore its background and painting style";

export const GRADE_KEYWORDS: Record<Grade, string> = {
  common: "simple humble outfit, plain colors",
  uncommon: "sturdy adventurer gear, green accents",
  rare: "polished equipment, blue magical glow accents",
  hero: "ornate armor or robes, purple aura, heroic pose",
  legendary: "radiant golden-orange aura, legendary weapon, epic silhouette",
};

export type PromptKind = "portrait" | "sheet" | "enemy" | "boss";

/** 이미지 생성 도구: midjourney는 --no, chat(Gemini·ChatGPT 등)은 Avoid: 문장 */
export type PromptTool = "midjourney" | "chat";

export interface PromptInput {
  name: string;
  /** 캐릭터 고유 외형 디스크립터 (영문 권장) */
  artRef: string;
  grade?: Grade;
  kind: PromptKind;
  /** 스프라이트 시트일 때 프레임 크기 */
  frameSize?: number;
  /** 빼고 싶은 요소를 쓰는 형식 (기본 midjourney) */
  tool?: PromptTool;
  /** 카드 일러스트를 참조 이미지로 함께 첨부하는지 */
  withReference?: boolean;
}

export function buildPrompt(input: PromptInput): string {
  const parts: string[] = [STYLE_BASE];

  // 캐릭터 고유 외형이 핵심 — 항상 스타일 바로 다음
  if (input.artRef.trim()) parts.push(input.artRef.trim());
  else parts.push(`character named ${input.name}`);

  switch (input.kind) {
    case "portrait":
      if (input.grade) parts.push(GRADE_KEYWORDS[input.grade]);
      parts.push("idle pose, standing on small circular base, front-facing 3/4 view");
      break;
    case "enemy":
      parts.push("menacing but comically cute expression, walking pose, side view");
      break;
    case "boss":
      parts.push(
        "huge imposing boss monster, screen-filling presence, dramatic lighting accents, walking pose, side view"
      );
      break;
    case "sheet": {
      const fs = input.frameSize ?? 64;
      if (input.grade) parts.push(GRADE_KEYWORDS[input.grade]);
      parts.push(
        "pixel-perfect sprite sheet for a 2D game, 4 rows of animation on a transparent background, each row is one animation, " +
          "row 1: 4 frames idle breathing loop, row 2: 4 frames attack (wind-up, strike, follow-through, recover), " +
          "row 3: 6 frames skill cast with glowing energy, row 4: 6 frames walk cycle, " +
          `every frame exactly ${fs}x${fs} pixels in a uniform grid, character always facing right, ` +
          "consistent size and position across all frames, no labels, no grid lines"
      );
      break;
    }
  }

  if (input.withReference) {
    parts.push(input.kind === "sheet" ? `${REFERENCE_LINE}, keep the same character design in every frame` : REFERENCE_LINE);
  }

  return `${parts.join(",\n")}\n${input.tool === "chat" ? STYLE_AVOID : STYLE_NEGATIVE}`;
}

export type CardGroup = "allies" | "enemies" | "bosses";

/** 카드 코드가 id에 없는 캐릭터 */
const SPECIAL_CARD_CODES: Record<string, string> = { "tw-esther-luteran": "3200018" };

/**
 * `npm run cards`(scripts/fetch-card-images.mjs)가 저장하는 카드 일러스트 경로 — 같은 규칙을 유지할 것
 * 예) tw-c3200500 뮨 히다카 → references/cards/allies/뮨 히다카_3200500.png
 */
export function cardImagePath(id: string, name: string, group: CardGroup): string | null {
  const code = SPECIAL_CARD_CODES[id] ?? /^(?:tw|en)-c(\d+)$/.exec(id)?.[1];
  if (!code || !name.trim()) return null;
  const safe = name.replace(/[<>:"/\\|?*]/g, "_").trim();
  return `references/cards/${group}/${safe}_${code}.png`;
}
