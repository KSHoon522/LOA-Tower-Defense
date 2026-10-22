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

export const STYLE_NEGATIVE =
  "--no realistic, photorealistic, 3d render, gradient shading, text, watermark, extra limbs";

export const GRADE_KEYWORDS: Record<Grade, string> = {
  common: "simple humble outfit, plain colors",
  uncommon: "sturdy adventurer gear, green accents",
  rare: "polished equipment, blue magical glow accents",
  hero: "ornate armor or robes, purple aura, heroic pose",
  legendary: "radiant golden-orange aura, legendary weapon, epic silhouette",
};

export type PromptKind = "portrait" | "sheet" | "enemy" | "boss";

export interface PromptInput {
  name: string;
  /** 캐릭터 고유 외형 디스크립터 (영문 권장) */
  artRef: string;
  grade?: Grade;
  kind: PromptKind;
  /** 스프라이트 시트일 때 프레임 크기 */
  frameSize?: number;
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

  return `${parts.join(",\n")}\n${STYLE_NEGATIVE}`;
}
