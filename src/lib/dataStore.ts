import { promises as fs } from "fs";
import path from "path";
import type { EntityKind } from "@/game/types";

const DATA_DIR = path.join(process.cwd(), "data");

export const ENTITY_KINDS: EntityKind[] = [
  "maps",
  "jobs",
  "towers",
  "enemies",
  "synergies",
  "gachas",
  "chapters",
];

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
