import { describe, expect, it } from "vitest";
import { buildPrompt, cardImagePath, fixerCommand, REFERENCE_LINE, STYLE_AVOID, STYLE_NEGATIVE, weaponHint } from "../prompt";

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

describe("주무기 문구", () => {
  it("궁수·총포인데 artRef에 무기가 없으면 붙이고, 있으면 붙이지 않는다", () => {
    expect(weaponHint("강습 화살", "winged maiden with a silver gauntlet")).toBe("main weapon: a bow with arrows");
    expect(weaponHint("강습 화살", "winged maiden holding a white longbow")).toBeNull();
    expect(weaponHint("관통 사격", "pirate captain with a tricorn hat")).toBe("main weapon: a firearm");
    expect(weaponHint("관통 사격", "flintlock pistol at the hip")).toBeNull();
    expect(weaponHint("마력 폭발", "old wizard")).toBeNull();
  });

  it("주무기 문구는 외형 바로 뒤, 등급 키워드(legendary weapon) 앞에 온다", () => {
    const p = buildPrompt({ name: "니나브", artRef: "winged maiden", grade: "legendary", kind: "portrait", skillName: "강습 화살" });
    expect(p.indexOf("main weapon: a bow")).toBeGreaterThan(p.indexOf("winged maiden"));
    expect(p.indexOf("main weapon: a bow")).toBeLessThan(p.indexOf("legendary weapon"));
  });
});

describe("적 2줄 시트 / 정리 명령", () => {
  it("적 시트는 대기·걷기 2줄만 요청한다", () => {
    const p = buildPrompt({ name: "릭투스", artRef: "wolf demon", kind: "sheet-walk", withReference: true });
    expect(p).toContain("2 rows of animation");
    expect(p).toContain("row 2: 6 frames walk cycle");
    expect(p).not.toContain("attack");
    expect(p).toContain("keep the same character design in every frame");
  });

  it("출력 형식에 맞는 정리 명령", () => {
    expect(fixerCommand("sheet", "tw-c3200021")).toContain("public/characters/tw-c3200021-sheet.png --rows 4,4,6,6");
    expect(fixerCommand("sheet-walk", "en-c3200105")).toContain("--rows 4,6");
    expect(fixerCommand("portrait", "tw-c3200021")).toContain("public/characters/tw-c3200021.png --single");
  });
});
