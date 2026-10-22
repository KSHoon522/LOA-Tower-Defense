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

function readBundle(dir: string): GameData {
  const read = <T>(name: string): T =>
    JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf-8")) as T;
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

/**
 * 테스트용 고정 데이터 (fixtures/*.json)
 * 게임 데이터(data/*.json)는 에디터로 계속 바뀌므로, 엔진 규칙 테스트는 고정된 데이터로 돌린다.
 */
export function loadData(): GameData {
  return readBundle(path.join(__dirname, "fixtures"));
}

/** 실제 게임 데이터 data/*.json (데이터 검증 테스트용, 프로젝트 루트에서 실행됨) */
export function loadGameData(): GameData {
  return readBundle(path.join(process.cwd(), "data"));
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
