/**
 * 시드 기반 결정론적 RNG (mulberry32)
 * - 같은 시드 → 같은 결과 순서: 리플레이/버그 재현/서버 검증 가능
 * - state 하나(uint32)만 저장하면 정확히 이어서 재생 가능
 */
export class Rng {
  private state: number;

  constructor(seed: number = Rng.randomSeed()) {
    this.state = seed >>> 0;
  }

  static randomSeed(): number {
    return (Math.random() * 0xffffffff) >>> 0;
  }

  /** 현재 내부 상태 (저장용) */
  getState(): number {
    return this.state;
  }

  setState(state: number) {
    this.state = state >>> 0;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state >>>= 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min));
  }

  /** pct 확률(%)로 true */
  chance(pct: number): boolean {
    return this.next() * 100 < pct;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) return this.pick(items).item;
    let r = this.next() * total;
    for (const { item, weight } of items) {
      r -= Math.max(0, weight);
      if (r <= 0) return item;
    }
    return items[items.length - 1].item;
  }
}
