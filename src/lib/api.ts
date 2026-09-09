import type { EntityKind, GameData } from "@/game/types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `요청 실패 (${res.status})`);
  }
  return res.json();
}

export async function fetchAll<T>(kind: EntityKind): Promise<T[]> {
  return handle(await fetch(`/api/data/${kind}`, { cache: "no-store" }));
}

export async function createEntity<T>(kind: EntityKind, item: T): Promise<T> {
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
): Promise<T> {
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
  const [maps, jobs, towers, enemies, synergies, gachas, chapters] =
    await Promise.all([
      fetchAll<GameData["maps"][number]>("maps"),
      fetchAll<GameData["jobs"][number]>("jobs"),
      fetchAll<GameData["towers"][number]>("towers"),
      fetchAll<GameData["enemies"][number]>("enemies"),
      fetchAll<GameData["synergies"][number]>("synergies"),
      fetchAll<GameData["gachas"][number]>("gachas"),
      fetchAll<GameData["chapters"][number]>("chapters"),
    ]);
  return { maps, jobs, towers, enemies, synergies, gachas, chapters };
}
