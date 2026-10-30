import { describe, expect, it } from "vitest";
import { parseFixerOutput } from "../spriteImport";

const SHEET_OUTPUT = `{
  "checker": { "colors": [[204, 204, 204], [254, 254, 254]], "square_sizes": [16.0] },
  "sheet": [1986, 880],
  "sprite": {
    "src": "/characters/luteran-sheet.png",
    "frameWidth": 331,
    "frameHeight": 220,
    "scale": 2.02,
    "facing": "right",
    "animations": {
      "idle": { "row": 0, "frames": 5, "fps": 6 },
      "attack": { "row": 1, "frames": 5, "fps": 20 },
      "skill": { "row": 2, "frames": 6, "fps": 10 },
      "walk": { "row": 3, "frames": 6, "fps": 8 }
    }
  }
}`;

describe("parseFixerOutput", () => {
  it("시트 출력 → sprite 설정", () => {
    const r = parseFixerOutput(SHEET_OUTPUT);
    expect("sprite" in r && r.sprite).toEqual({
      src: "/characters/luteran-sheet.png",
      frameWidth: 331,
      frameHeight: 220,
      scale: 2.02,
      facing: "right",
      animations: {
        idle: { row: 0, frames: 5, fps: 6 },
        attack: { row: 1, frames: 5, fps: 20 },
        skill: { row: 2, frames: 6, fps: 10 },
        walk: { row: 3, frames: 6, fps: 8 },
      },
    });
  });

  it("--single 출력과 뒤에 붙은 안내 문장도 처리", () => {
    const text = `{\n  "mode": "solid",\n  "background": { "background": [255, 255, 255] },\n  "size": [512, 512],\n  "image": "/characters/tw-c3200021.png"\n}\n참고: 외곽선에 갇힌 배경색 영역이 1곳 있습니다 {크기}`;
    expect(parseFixerOutput(text)).toEqual({ image: "/characters/tw-c3200021.png" });
  });

  it("필수 항목이 없거나 JSON이 아니면 오류", () => {
    expect("error" in parseFixerOutput("아무 글")).toBe(true);
    expect("error" in parseFixerOutput('{"sprite": {"src": "/a.png", "frameWidth": 64, "frameHeight": 64, "animations": {}}}')).toBe(true);
    expect("error" in parseFixerOutput('{"mode": "solid"}')).toBe(true);
  });
});
