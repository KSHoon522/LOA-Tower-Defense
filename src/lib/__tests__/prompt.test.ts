import { describe, expect, it } from "vitest";
import { buildPrompt, cardImagePath, REFERENCE_LINE, STYLE_AVOID, STYLE_NEGATIVE } from "../prompt";

describe("buildPrompt", () => {
  const base = { name: "뮨 히다카", artRef: "rugged man with a full beard", grade: "hero" as const };

  it("기본은 Midjourney 형식(--no)이고 참조 문장이 없다", () => {
    const p = buildPrompt({ ...base, kind: "portrait" });
    expect(p.endsWith(STYLE_NEGATIVE)).toBe(true);
    expect(p).not.toContain(REFERENCE_LINE);
  });

  it("Gemini·ChatGPT 형식은 Avoid: 문장으로 끝난다", () => {
    const p = buildPrompt({ ...base, kind: "portrait", tool: "chat" });
    expect(p.endsWith(STYLE_AVOID)).toBe(true);
    expect(p).not.toContain("--no");
  });

  it("카드 이미지 첨부 시 참조 문장을 붙이고, 시트는 프레임 간 일관성도 요구한다", () => {
    expect(buildPrompt({ ...base, kind: "boss", withReference: true })).toContain(REFERENCE_LINE);
    expect(buildPrompt({ ...base, kind: "sheet", withReference: true })).toContain("keep the same character design in every frame");
  });
});

describe("cardImagePath", () => {
  it("npm run cards와 같은 경로 규칙", () => {
    expect(cardImagePath("tw-c3200500", "뮨 히다카", "allies")).toBe("references/cards/allies/뮨 히다카_3200500.png");
    expect(cardImagePath("en-c3200509", "빌헬름", "bosses")).toBe("references/cards/bosses/빌헬름_3200509.png");
    expect(cardImagePath("tw-esther-luteran", "에스더 루테란", "allies")).toBe(
      "references/cards/allies/에스더 루테란_3200018.png",
    );
  });

  it("파일 이름에 못 쓰는 문자는 _로, 카드가 없는 캐릭터는 null", () => {
    expect(cardImagePath("tw-c3200999", "가:나?", "allies")).toBe("references/cards/allies/가_나__3200999.png");
    expect(cardImagePath("tw-custom", "새 캐릭터", "allies")).toBeNull();
  });
});
