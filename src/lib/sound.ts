import type { GameEventType } from "@/game/types";

/**
 * 효과음 (Web Audio 합성 — 음원 파일 없이 오실레이터/노이즈로 생성)
 * - 엔진 이벤트(engine.drainEvents())를 받아 재생
 * - 이벤트 종류별 최소 간격으로 연타 방지 (2배속 전투에서도 시끄럽지 않게)
 * - 브라우저 자동재생 정책: 첫 사용자 입력에서 unlock() 호출 필요
 * - 나중에 실제 음원을 쓰려면 play()에서 AudioBuffer 재생으로 교체하면 됨
 */

interface Voice {
  /** 노이즈 버스트 (타격감) */
  noise?: boolean;
  wave?: OscillatorType;
  freq?: number;
  /** 끝 주파수 (지정 시 피치 슬라이드) */
  to?: number;
  dur: number;
  gain: number;
  delay?: number;
}

interface Recipe {
  voices: Voice[];
  /** 같은 이벤트의 최소 재생 간격(초) */
  minGap: number;
}

/** 음 이름 → 주파수 */
const N = {
  C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77,
  C6: 1046.5, E6: 1318.51, G6: 1567.98, C7: 2093.0,
};

const arp = (notes: number[], step: number, dur: number, gain: number, wave: OscillatorType = "triangle"): Voice[] =>
  notes.map((freq, i) => ({ wave, freq, dur, gain, delay: i * step }));

const RECIPES: Record<GameEventType, Recipe> = {
  shot: { minGap: 0.07, voices: [{ wave: "triangle", freq: 880, to: 620, dur: 0.05, gain: 0.03 }] },
  hit: { minGap: 0.06, voices: [{ noise: true, dur: 0.045, gain: 0.05 }] },
  crit: {
    minGap: 0.09,
    voices: [
      { wave: "square", freq: 1300, to: 1900, dur: 0.07, gain: 0.04 },
      { noise: true, dur: 0.06, gain: 0.06 },
    ],
  },
  skill: { minGap: 0.15, voices: [{ wave: "sawtooth", freq: 320, to: 960, dur: 0.22, gain: 0.05 }] },
  kill: { minGap: 0.06, voices: [{ wave: "triangle", freq: 520, to: 240, dur: 0.1, gain: 0.05 }] },
  boss_spawn: {
    minGap: 1,
    voices: [
      { wave: "sawtooth", freq: 110, to: 70, dur: 0.9, gain: 0.12 },
      { wave: "square", freq: 55, dur: 0.9, gain: 0.06 },
    ],
  },
  boss_kill: { minGap: 0.5, voices: arp([N.C5, N.E5, N.G5, N.C6], 0.09, 0.22, 0.1) },
  leak: {
    minGap: 0.25,
    voices: [
      { wave: "square", freq: 240, to: 110, dur: 0.3, gain: 0.08 },
      { noise: true, dur: 0.12, gain: 0.05 },
    ],
  },
  wave_start: { minGap: 0.3, voices: arp([N.A4, N.E5], 0.12, 0.16, 0.08) },
  early_call: {
    minGap: 0.3,
    voices: [
      { wave: "triangle", freq: 660, to: 990, dur: 0.14, gain: 0.08 },
      { wave: "triangle", freq: 990, dur: 0.14, gain: 0.07, delay: 0.1 },
    ],
  },
  wave_clear: { minGap: 0.3, voices: arp([N.G4, N.C5, N.E5], 0.1, 0.18, 0.08) },
  gacha: { minGap: 0.05, voices: [{ wave: "sine", freq: 700, to: 1050, dur: 0.12, gain: 0.07 }] },
  gacha_esther: {
    minGap: 0.3,
    voices: [...arp([N.C6, N.E6, N.G6, N.C7], 0.07, 0.3, 0.07, "sine"), { noise: true, dur: 0.3, gain: 0.02, delay: 0.28 }],
  },
  fusion: {
    minGap: 0.1,
    voices: [
      { wave: "sine", freq: 400, to: 800, dur: 0.18, gain: 0.08 },
      { wave: "sine", freq: 800, to: 1200, dur: 0.15, gain: 0.07, delay: 0.14 },
    ],
  },
  fusion_jackpot: { minGap: 0.3, voices: arp([N.C5, N.E5, N.G5, N.C6, N.E6], 0.07, 0.25, 0.08, "sine") },
  place: { minGap: 0.05, voices: [{ wave: "triangle", freq: 320, to: 190, dur: 0.07, gain: 0.07 }] },
  sell: {
    minGap: 0.05,
    voices: [
      { wave: "sine", freq: 900, to: 1300, dur: 0.07, gain: 0.06 },
      { wave: "sine", freq: 1300, dur: 0.09, gain: 0.05, delay: 0.06 },
    ],
  },
  job_skill: {
    minGap: 0.2,
    voices: [
      { wave: "sawtooth", freq: 200, to: 640, dur: 0.35, gain: 0.08 },
      { noise: true, dur: 0.25, gain: 0.04 },
    ],
  },
  mission_success: { minGap: 0.3, voices: arp([N.E5, N.G5, N.B5, N.E6], 0.08, 0.2, 0.07, "sine") },
  mission_fail: {
    minGap: 0.3,
    voices: [
      { wave: "square", freq: 300, to: 220, dur: 0.18, gain: 0.05 },
      { wave: "square", freq: 220, to: 150, dur: 0.22, gain: 0.05, delay: 0.16 },
    ],
  },
  victory: { minGap: 1, voices: arp([N.C5, N.E5, N.G5, N.C6], 0.14, 0.5, 0.1) },
  defeat: { minGap: 1, voices: arp([N.G4, N.E4, N.C4, 196], 0.22, 0.4, 0.08, "sawtooth") },
};

const STORAGE_KEY = "rotadi:sound:volume";
/** 볼륨 단계 (버튼으로 순환) */
export const VOLUME_STEPS = [0, 0.4, 1];

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<GameEventType, number>();
  volume = VOLUME_STEPS[1];

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null && Number.isFinite(Number(saved))) this.volume = Number(saved);
    } catch {
      /* 저장소 접근 불가 — 기본값 사용 */
    }
  }

  /** 사용자 입력(클릭/터치) 안에서 호출해야 소리가 난다 */
  unlock() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* 무시 */
    }
  }

  /** 다음 볼륨 단계로 (음소거 → 작게 → 크게) */
  cycleVolume(): number {
    const i = VOLUME_STEPS.indexOf(this.volume);
    const next = VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length];
    this.setVolume(next);
    return next;
  }

  /** 한 프레임에 쌓인 이벤트 재생 (같은 종류는 1번만) */
  playAll(events: GameEventType[]) {
    if (events.length === 0) return;
    for (const type of Array.from(new Set(events))) this.play(type);
  }

  play(type: GameEventType) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.volume <= 0 || ctx.state !== "running") return;
    const recipe = RECIPES[type];
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(type) ?? -Infinity;
    if (now - last < recipe.minGap) return;
    this.lastPlayed.set(type, now);
    for (const v of recipe.voices) this.voice(ctx, this.master, v, now);
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private voice(ctx: AudioContext, out: AudioNode, v: Voice, t0: number) {
    const start = t0 + (v.delay ?? 0);
    const end = start + v.dur;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(v.gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(out);

    let src: AudioScheduledSourceNode;
    if (v.noise) {
      const b = ctx.createBufferSource();
      b.buffer = this.noiseBuffer(ctx);
      src = b;
    } else {
      const o = ctx.createOscillator();
      o.type = v.wave ?? "sine";
      o.frequency.setValueAtTime(v.freq ?? 440, start);
      if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, end);
      src = o;
    }
    src.connect(env);
    src.start(start);
    src.stop(end + 0.02);
  }
}

let instance: SoundManager | null = null;

/** 브라우저에서만 생성되는 싱글턴 (SSR에서는 null) */
export function getSound(): SoundManager | null {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new SoundManager();
  return instance;
}
