import type { SaveSlot } from "@/game/types";

/**
 * 게임 저장 슬롯 (localStorage)
 * - 지금은 브라우저 로컬, 추후 서버 저장으로 교체 가능한 인터페이스
 */
const KEY = "rotadi:save:v1";

export function loadSave(): SaveSlot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSlot;
    if (!parsed?.snapshot || parsed.snapshot.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSave(slot: SaveSlot): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(slot));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
