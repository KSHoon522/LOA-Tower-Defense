import type { EntityKind, GameData } from "@/game/types";
import type { ValidationIssue } from "@/game/validate";

/** API 오류 — 검증 실패 시 issues에 상세 목록이 담긴다 */
export class ApiError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `요청 실패 (${res.status})`, body.issues ?? []);
  }
  return res.json();
}

/** 저장 결과: 저장된 항목 + 저장은 됐지만 확인이 필요한 경고 */
export interface SaveResult<T> {
  item: T;
  warnings: ValidationIssue[];
}

export async function fetchAll<T>(kind: EntityKind): Promise<T[]> {
  return handle(await fetch(`/api/data/${kind}`, { cache: "no-store" }));
}

export async function createEntity<T>(kind: EntityKind, item: T): Promise<SaveResult<T>> {
  return handle(
    await fetch(`/api/data/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    })
  );
}

export async function updateEntity<T>(
  kind: EntityKind,
  id: string,
  item: T
): Promise<SaveResult<T>> {
  return handle(
    await fetch(`/api/data/${kind}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    })
  );
}

export async function deleteEntity(kind: EntityKind, id: string): Promise<void> {
  await handle(
    await fetch(`/api/data/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" })
  );
}

export async function fetchGameData(): Promise<GameData> {
  const [maps, jobs, towers, enemies, synergies, gachas, chapters, missions] =
    await Promise.all([
      fetchAll<GameData["maps"][number]>("maps"),
      fetchAll<GameData["jobs"][number]>("jobs"),
      fetchAll<GameData["towers"][number]>("towers"),
      fetchAll<GameData["enemies"][number]>("enemies"),
      fetchAll<GameData["synergies"][number]>("synergies"),
      fetchAll<GameData["gachas"][number]>("gachas"),
      fetchAll<GameData["chapters"][number]>("chapters"),
      fetchAll<GameData["missions"][number]>("missions"),
    ]);
  return { maps, jobs, towers, enemies, synergies, gachas, chapters, missions };
}

// ============================================================
// 전체 데이터 점검 / 내보내기 / 가져오기
// ============================================================

/** 내보내기 파일 형식 */
export interface DataBundleFile {
  format: "rotadi-data";
  version: 1;
  exportedAt: string;
  data: Partial<GameData>;
}

export interface BundleReport {
  issues: ValidationIssue[];
  counts: Partial<Record<EntityKind, number>>;
}

/** 현재 전체 데이터 + 검증 결과 */
export async function fetchBundleReport(): Promise<BundleReport & { file: DataBundleFile }> {
  return handle(await fetch("/api/bundle", { cache: "no-store" }));
}

/**
 * 가져오기 — 파일에 포함된 종류만 교체.
 * dryRun이면 검증 결과만 반환 (저장 안 함)
 */
export async function importBundle(
  file: DataBundleFile,
  dryRun: boolean
): Promise<BundleReport & { replaced: EntityKind[] }> {
  return handle(
    await fetch(`/api/bundle${dryRun ? "?dryRun=1" : ""}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(file),
    })
  );
}
