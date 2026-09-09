/** 가중치 기반 랜덤 선택 유틸 */

export function weightedPick<T>(items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)].item;
  }
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= Math.max(0, weight);
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** pct 확률(%)로 true */
export function chance(pct: number): boolean {
  return Math.random() * 100 < pct;
}
