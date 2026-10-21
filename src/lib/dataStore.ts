import { promises as fs } from "fs";
import path from "path";
import { ENTITY_KINDS } from "@/game/constants";
import type { EntityKind, GameData } from "@/game/types";
import { validateItem, type ValidationIssue } from "@/game/validate";

export { ENTITY_KINDS };

const DATA_DIR = path.join(process.cwd(), "data");

export function isEntityKind(v: string): v is EntityKind {
  return (ENTITY_KINDS as string[]).includes(v);
}

function fileFor(kind: EntityKind): string {
  return path.join(DATA_DIR, `${kind}.json`);
}

export async function readAll<T = unknown>(kind: EntityKind): Promise<T[]> {
  try {
    const raw = await fs.readFile(fileFor(kind), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeAll(kind: EntityKind, items: unknown[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(fileFor(kind), JSON.stringify(items, null, 2), "utf-8");
}

/** 전체 데이터 묶음 (참조 무결성 검사 / 내보내기용) */
export async function readBundle(): Promise<GameData> {
  const entries = await Promise.all(
    ENTITY_KINDS.map(async (kind) => [kind, await readAll(kind)] as const)
  );
  return Object.fromEntries(entries) as unknown as GameData;
}

/** 저장하려는 항목을 현재 데이터에 반영한 상태로 검증 (참조 무결성 포함) */
export async function validateAgainstStore(
  kind: EntityKind,
  item: unknown
): Promise<ValidationIssue[]> {
  const bundle = await readBundle();
  const id = (item as { id?: string } | null)?.id;
  const others = (bundle[kind] as { id: string }[]).filter((i) => i.id !== id);
  const candidate = { ...bundle, [kind]: [...others, item] } as GameData;
  return validateItem(kind, item, candidate);
}

interface HasId {
  id: string;
}

export async function createItem(kind: EntityKind, item: HasId): Promise<HasId> {
  const items = await readAll<HasId>(kind);
  if (!item.id) throw new Error("id가 필요합니다");
  if (items.some((i) => i.id === item.id)) {
    throw new Error(`중복 id: ${item.id}`);
  }
  items.push(item);
  await writeAll(kind, items);
  return item;
}

export async function updateItem(
  kind: EntityKind,
  id: string,
  item: HasId
): Promise<HasId> {
  const items = await readAll<HasId>(kind);
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error(`존재하지 않는 id: ${id}`);
  items[idx] = { ...item, id: item.id || id };
  await writeAll(kind, items);
  return items[idx];
}

export async function deleteItem(kind: EntityKind, id: string): Promise<void> {
  const items = await readAll<HasId>(kind);
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) throw new Error(`존재하지 않는 id: ${id}`);
  await writeAll(kind, next);
}
