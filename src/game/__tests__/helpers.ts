import { readFileSync } from "fs";
import path from "path";
import type { EngineOptions } from "../engine";
import type {
  ChapterDef,
  EnemyDef,
  GachaDef,
  GameData,
  JobDef,
  MapDef,
  MissionDef,
  SynergyDef,
  TowerDef,
} from "../types";

/** data/*.json 로드 (테스트는 프로젝트 루트에서 실행됨) */
export function loadData(): GameData {
  const read = <T>(name: string): T =>
    JSON.parse(readFileSync(path.join(process.cwd(), "data", `${name}.json`), "utf-8")) as T;
  return {
    maps: read<MapDef[]>("maps"),
    jobs: read<JobDef[]>("jobs"),
    towers: read<TowerDef[]>("towers"),
    enemies: read<EnemyDef[]>("enemies"),
    synergies: read<SynergyDef[]>("synergies"),
    gachas: read<GachaDef[]>("gachas"),
    chapters: read<ChapterDef[]>("chapters"),
    missions: read<MissionDef[]>("missions"),
  };
}

/** 기본 엔진 옵션 (첫 챕터/스테이지, 시드 고정) */
export function baseOptions(overrides: Partial<EngineOptions> = {}): EngineOptions {
  const d = loadData();
  const chapter = d.chapters[0];
  const map = d.maps.find((m) => m.id === chapter.mapId) ?? d.maps[0];
  return {
    map,
    towers: d.towers,
    enemies: d.enemies,
    synergies: d.synergies,
    gachas: d.gachas,
    missions: d.missions,
    job: null,
    difficulty: "easy",
    stage: chapter.stages[0],
    seed: 42,
    ...overrides,
  };
}

/** 첫 번째 건설 가능 타일 */
export function firstBuildable(map: MapDef): { x: number; y: number } {
  for (let y = 0; y < map.rows; y++) {
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y][x] === "buildable") return { x, y };
    }
  }
  throw new Error("건설 가능 타일 없음");
}
