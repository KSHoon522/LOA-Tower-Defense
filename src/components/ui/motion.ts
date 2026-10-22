"use client";

import { useEffect, useRef, useState } from "react";

/** 사용자가 '움직임 줄이기'를 켰는지 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * 등장/퇴장 애니메이션용 마운트 상태
 * - open=false가 되어도 exitMs 동안은 남겨두고 closing=true로 퇴장 애니메이션을 재생
 */
export function usePresence(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted: mounted || open, closing: closing && !open };
}

/** 숫자를 부드럽게 따라가는 표시값 (골드 카운터 등) */
export function useTweenedNumber(value: number, duration = 420): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const from = displayRef.current;
    if (from === value) return;
    if (prefersReducedMotion()) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (value - from) * eased;
      displayRef.current = v;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return Math.round(display);
}

/**
 * 값이 바뀔 때마다 증가하는 키 + 방향 — 요소의 key로 쓰면 CSS 애니메이션이 다시 재생됨
 * (예: 목숨이 줄면 하트 판이 흔들림)
 */
export function useChangePulse(value: number): { key: number; dir: -1 | 0 | 1 } {
  const prev = useRef(value);
  const [state, setState] = useState<{ key: number; dir: -1 | 0 | 1 }>({ key: 0, dir: 0 });
  useEffect(() => {
    if (value === prev.current) return;
    const dir = value > prev.current ? 1 : -1;
    prev.current = value;
    setState((s) => ({ key: s.key + 1, dir }));
  }, [value]);
  return state;
}
