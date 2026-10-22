import { describe, expect, it } from "vitest";
import {
  findReferences,
  gachaRefundExpectation,
  hasErrors,
  validateBundle,
  validateItem,
} from "../validate";
import type { GameData } from "../types";
import { loadData, loadGameData } from "./helpers";

const data = loadData();

function clone(): GameData {
  return structuredClone(data);
}

describe("데이터 검증", () => {
  it("저장소의 data/*.json에는 오류가 없다", () => {
    const errors = validateBundle(loadGameData()).filter((i) => i.level === "error");
    expect(errors).toEqual([]);
  });

  it("스키마 위반은 필드 경로와 함께 오류가 된다", () => {
    const tower = { ...data.towers[0], attackSpeed: 0 };
    const issues = validateItem("towers", tower, data);
    expect(hasErrors(issues)).toBe(true);
    expect(issues.find((i) => i.level === "error")?.path).toBe("attackSpeed");
  });

  it("필수 필드가 없으면 오류", () => {
    const { name: _name, ...noName } = data.enemies[0];
    expect(hasErrors(validateItem("enemies", noName, data))).toBe(true);
  });

  it("챕터가 없는 맵/적을 참조하면 오류", () => {
    const ch = structuredClone(data.chapters[0]);
    ch.mapId = "map-nope";
    ch.stages[0].enemyIds = ["en-nope"];
    const paths = validateItem("chapters", ch, data)
      .filter((i) => i.level === "error")
      .map((i) => i.path);
    expect(paths).toContain("mapId");
    expect(paths).toContain("stages[0].enemyIds[0]");
  });

  it("분열이 순환하면 오류 (무한 분열 방지)", () => {
    const d = clone();
    const a = { ...d.enemies[0], id: "en-a", traits: [{ type: "split" as const, enemyId: "en-b", count: 2 }] };
    const b = { ...d.enemies[0], id: "en-b", traits: [{ type: "split" as const, enemyId: "en-a", count: 2 }] };
    d.enemies.push(a, b);
    expect(hasErrors(validateItem("enemies", a, d))).toBe(true);
    const self = { ...a, traits: [{ type: "split" as const, enemyId: "en-a", count: 2 }] };
    expect(hasErrors(validateItem("enemies", self, d))).toBe(true);
  });

  it("시너지 단계 인원은 오름차순이어야 한다", () => {
    const syn = structuredClone(data.synergies[0]);
    syn.tiers = [
      { count: 4, effects: [] },
      { count: 2, effects: [] },
    ];
    expect(hasErrors(validateItem("synergies", syn, data))).toBe(true);
  });

  it("뽑고 바로 팔아도 이득인 뽑기는 경고한다", () => {
    const g = { id: "g", name: "g", cost: 10, rates: { esther: 100 }, regionMode: "any" as const };
    expect(gachaRefundExpectation(g.rates)).toBeGreaterThan(g.cost);
    const issues = validateItem("gachas", g, data);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.some((i) => i.level === "warning" && i.path === "cost")).toBe(true);
  });

  it("직업 뽑기 할인으로 판매 이득이 생기면 뽑기와 직업 양쪽에서 경고한다", () => {
    const g = { id: "g", name: "g", cost: 20, rates: { common: 100 }, regionMode: "any" as const };
    // 할인 없이: 비용 20G > 일반 판매가 → 안전
    expect(gachaRefundExpectation(g.rates)).toBeLessThan(g.cost);
    const d = clone();
    d.gachas = [g];
    const cheap = {
      ...d.jobs[0],
      id: "job-cheap",
      skills: [{ kind: "passive" as const, name: "흥정", type: "gacha_discount_pct" as const, value: 90 }],
    };
    d.jobs.push(cheap);
    const gachaIssues = validateItem("gachas", g, d);
    expect(gachaIssues.some((i) => i.path === "cost" && i.message.includes(cheap.name))).toBe(true);
    const jobIssues = validateItem("jobs", cheap, d);
    expect(jobIssues.some((i) => i.level === "warning" && i.path === "skills[0]")).toBe(true);
  });

  it("고정 지역 뽑기에 지역이 없으면 오류", () => {
    const g = { id: "g", name: "g", cost: 100, rates: { common: 1 }, regionMode: "fixed" as const, fixedRegion: "" };
    expect(hasErrors(validateItem("gachas", g, data))).toBe(true);
  });

  it("맵 타일 크기가 cols/rows와 다르면 오류", () => {
    const map = structuredClone(data.maps[0]);
    map.tiles = map.tiles.slice(1);
    expect(hasErrors(validateItem("maps", map, data))).toBe(true);
  });

  it("중복 id는 오류", () => {
    const d = clone();
    d.towers.push(structuredClone(d.towers[0]));
    expect(validateBundle(d).some((i) => i.level === "error" && i.message.includes("중복 id"))).toBe(true);
  });
});

describe("참조 무결성 (삭제)", () => {
  it("챕터가 쓰는 맵/적은 참조로 잡힌다", () => {
    const ch = data.chapters[0];
    expect(findReferences("maps", ch.mapId, data).length).toBeGreaterThan(0);
    const enemyId = ch.stages[0].enemyIds[0];
    expect(findReferences("enemies", enemyId, data).some((r) => r.kind === "chapters")).toBe(true);
  });

  it("분열 대상 적은 참조로 잡힌다", () => {
    const parent = data.enemies.find((e) => e.traits?.some((t) => t.type === "split"));
    if (!parent) return;
    const split = parent.traits!.find((t) => t.type === "split") as { enemyId: string };
    expect(findReferences("enemies", split.enemyId, data).some((r) => r.id === parent.id)).toBe(true);
  });

  it("아무도 쓰지 않는 항목은 참조가 없다", () => {
    expect(findReferences("maps", "map-unused-xyz", data)).toEqual([]);
  });
});
