"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BENCH_SIZE, GRADE_COLOR, GRADE_LABEL, GRADE_ORDER, TARGET_MODE_LABEL } from "@/game/constants";
import { GameEngine } from "@/game/engine";
import { gachaCost, sellRefund } from "@/game/gacha";
import { createViewState, displaySize, drawGame, screenToMap, type ViewState } from "@/game/render";
import type { Difficulty, EnemyUnit, GameData, GameEventType, Point, TargetMode, TowerDef } from "@/game/types";
import { fetchGameData } from "@/lib/api";
import { clearSave, loadSave, writeSave } from "@/lib/save";
import { getSound } from "@/lib/sound";
import GradeSlot from "./ui/GradeSlot";
import Icon, { JOB_GROUP_ICON, type IconName } from "./ui/Icon";
import { Modal } from "./ui/Overlay";
import Sigil from "./ui/Sigil";
import { prefersReducedMotion, useChangePulse, useTweenedNumber } from "./ui/motion";
import BenchSlots from "./game/BenchSlots";
import { BannerLayer, ToastStack, type BannerData, type ToastData } from "./game/Banners";
import { FusionPopover, PauseMenu, ResultOverlay, UnitQuickMenu } from "./game/Overlays";
import ShopPanel from "./game/ShopPanel";
import SkillButton from "./game/SkillButton";
import { SynergyChips, SynergyDetailList, SynergyRows } from "./game/SynergyPanel";
import { EnemyDetail, TowerDetail } from "./game/UnitDetail";
import { BossCard, MissionCard, NextWave, type MissionInfo } from "./game/WaveIntel";

/**
 * 게임 전투 화면
 * - 데스크톱(lg+): 좌측 직업·시너지 / 가운데 전장 / 우측 정보·웨이브, 하단 도크(스킬·대기석·소환·웨이브)
 * - 모바일(<lg): 전장 위 칩·스킬 버튼 + 하단 도크(대기석·소환·웨이브)
 * - 마우스/터치 공용 포인터 이벤트, 엔진 이벤트 → 배너/토스트/사운드
 */
export default function GameClient() {
  const router = useRouter();
  const params = useSearchParams();
  const resume = params.get("resume") === "1";
  const saved = useMemo(() => (resume ? loadSave() : null), [resume]);
  const chapterId = saved?.chapterId ?? params.get("chapter") ?? "";
  const stageId = saved?.stageId ?? params.get("stage") ?? "";
  const diff = (saved?.difficulty ?? params.get("diff") ?? "easy") as Difficulty;
  const jobId = saved?.jobId ?? params.get("job") ?? "";

  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ViewState>(createViewState(48));
  const hoverFloatRef = useRef<Point | null>(null);
  const pointerRef = useRef<{
    startX: number;
    startY: number;
    uid: string | null;
    moved: boolean;
    /** 롱프레스로 메뉴를 연 경우 — 손을 떼도 탭으로 처리하지 않음 */
    longPressed?: boolean;
  } | null>(null);

  const [, setUiTick] = useState(0);
  const [tileSize, setTileSize] = useState(48);
  /** 세로로 긴 화면에서는 맵을 90° 돌려 타일을 크게 */
  const [rotated, setRotated] = useState(false);
  const [dpr, setDpr] = useState(1);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [fusionTargetUid, setFusionTargetUid] = useState<string | null>(null);
  const [aimSkillIndex, setAimSkillIndex] = useState<number | null>(null);
  const [gachaRegionSel, setGachaRegionSel] = useState<string>("");
  const [sheet, setSheet] = useState<"none" | "synergy" | "log">("none");
  const [shopOpen, setShopOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  /** 가장 최근에 사용한 뽑기 (소환 버튼이 반복) */
  const [lastGacha, setLastGacha] = useState<{ id: string; region?: string } | null>(null);
  /** 합성 popover 위치 (합성 대상 지정한 지점 근처에 표시) */
  const [fusionPopoverPos, setFusionPopoverPos] = useState<{ x: number; y: number } | null>(null);
  /** 대기석 카드 드래그 고스트 */
  const [benchGhost, setBenchGhost] = useState<{ x: number; y: number; defId: string } | null>(null);
  const benchDragUidRef = useRef<string | null>(null);
  const suppressBenchClickRef = useRef<string | null>(null);
  /** 유닛 빠른 메뉴 (터치 롱프레스 / 마우스 우클릭) */
  const [unitMenu, setUnitMenu] = useState<{ uid: string; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  /** 메뉴 배경에서 시작한 탭인지 (메뉴를 연 롱프레스의 뒤따르는 click으로 바로 닫히지 않게) */
  const menuBackdropDownRef = useRef(false);
  /** 효과음 볼륨 (SSR 불일치 방지: 마운트 후 로드) */
  const [volume, setVolume] = useState<number | null>(null);
  /** 화면 연출 */
  const [banner, setBanner] = useState<(BannerData & { shownAt: number }) | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [leakKey, setLeakKey] = useState(0);
  const fxIdRef = useRef(0);

  useEffect(() => {
    setDpr(Math.min(2, window.devicePixelRatio || 1));
    setVolume(getSound()?.volume ?? 0);
    viewRef.current.reducedMotion = prefersReducedMotion();
    fetchGameData().then(setData).catch((e) => setError(e.message));
  }, []);

  // 엔진 생성
  useEffect(() => {
    if (!data) return;
    const chapter = data.chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      setError("챕터를 찾을 수 없습니다.");
      return;
    }
    const stage = chapter.stages.find((s) => s.id === stageId) ?? chapter.stages[0];
    if (!stage) {
      setError("스테이지를 찾을 수 없습니다.");
      return;
    }
    const map = data.maps.find((m) => m.id === chapter.mapId);
    if (!map || map.paths.length === 0) {
      setError("맵을 찾을 수 없거나 경로가 없습니다.");
      return;
    }
    const job = data.jobs.find((j) => j.id === jobId) ?? null;
    const opts = {
      map,
      towers: data.towers,
      enemies: data.enemies,
      synergies: data.synergies,
      gachas: data.gachas,
      missions: data.missions,
      job,
      difficulty: diff,
      stage,
    };
    // 이어하기: 저장 스냅샷 복원, 아니면 새 게임 (이전 세이브는 덮어씀)
    if (saved) {
      try {
        engineRef.current = GameEngine.restore(opts, saved.snapshot);
      } catch {
        engineRef.current = new GameEngine(opts);
      }
    } else {
      engineRef.current = new GameEngine(opts);
    }
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __rotadi?: GameEngine }).__rotadi = engineRef.current;
    }
    setUiTick((v) => v + 1);
  }, [data, chapterId, stageId, jobId, diff, saved]);

  const engine = engineRef.current;

  // ---- 자동 저장 ----
  // 1) 웨이브 단위: 웨이브 클리어로 준비 단계에 들어올 때 1회 저장
  // 2) 안전망: 탭 닫기/숨김 시 현재 상태 저장 (전투 중이어도 그대로 복원 가능)
  // 승리/패배 시 세이브 삭제
  const saveNow = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.phase === "victory" || eng.phase === "defeat") {
      clearSave();
      return;
    }
    writeSave({
      chapterId,
      stageId,
      jobId,
      difficulty: diff,
      savedAt: Date.now(),
      snapshot: eng.serialize(),
    });
  }, [chapterId, stageId, jobId, diff]);

  const lastSavedWaveRef = useRef(-1);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.phase === "prep" && eng.wave !== lastSavedWaveRef.current) {
      lastSavedWaveRef.current = eng.wave;
      saveNow();
    } else if (eng.phase === "victory" || eng.phase === "defeat") {
      clearSave();
    }
  }, [engine?.phase, engine?.wave, saveNow, engine]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    window.addEventListener("beforeunload", saveNow);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", saveNow);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveNow]);

  // 화면 크기에 맞춰 타일 크기 계산 (전장 테두리 여백 포함)
  useEffect(() => {
    const el = areaRef.current;
    const eng = engineRef.current;
    if (!el || !eng) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const pad = rect.width >= 640 ? 44 : 24;
      const w = rect.width - pad;
      const h = rect.height - pad;
      const normal = Math.min(w / eng.map.cols, h / eng.map.rows);
      const turned = Math.min(w / eng.map.rows, h / eng.map.cols);
      // 돌렸을 때 타일이 확실히 커질 때만 회전 (데스크톱 가로 화면은 그대로)
      const rot = turned > normal * 1.15;
      viewRef.current.rotated = rot;
      setRotated(rot);
      setTileSize(Math.floor(Math.max(16, rot ? turned : normal)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [engine]);

  // 합성 후보
  const fusionCandidates = useMemo(() => {
    if (!engine || !selectedUid) return new Set<string>();
    void engine.version;
    return new Set(engine.fusionCandidates(selectedUid));
  }, [engine, selectedUid, engine?.version]);

  // ---- 연출: 배너 / 토스트 ----
  const showBanner = useCallback((b: Omit<BannerData, "id">) => {
    const id = ++fxIdRef.current;
    setBanner({ ...b, id, shownAt: performance.now() });
    window.setTimeout(() => setBanner((cur) => (cur?.id === id ? null : cur)), 2000);
  }, []);

  const toast = useCallback((text: string, icon?: IconName, color?: string) => {
    const id = ++fxIdRef.current;
    setToasts((ts) => [...ts.slice(-2), { id, text, icon, color }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 2600);
  }, []);

  /** 엔진 이벤트 → 화면 연출 (사운드는 루프에서 따로 재생) */
  const handleEvents = useCallback(
    (evs: GameEventType[], eng: GameEngine) => {
      const lastLog = (re: RegExp) => [...eng.logs].reverse().find((l) => re.test(l.text))?.text;
      for (const ev of evs) {
        switch (ev) {
          case "wave_start": {
            const boss = eng.isBossWave(eng.wave);
            showBanner({
              kind: boss ? "boss" : "wave",
              kicker: boss ? "Boss Wave" : eng.stage?.name ?? "Wave",
              title: `WAVE ${eng.wave}`,
              sub: boss ? "보스가 다가옵니다" : eng.wave === eng.totalWaves ? "마지막 웨이브" : undefined,
            });
            break;
          }
          case "boss_spawn": {
            const b = [...eng.enemies].reverse().find((e) => e.isBoss);
            const name = b ? eng.enemyDefs.get(b.defId)?.name : undefined;
            viewRef.current.shakeUntil = performance.now() + 420;
            // 웨이브 시작 배너가 막 떠 있으면 다시 띄우지 않고 보스 이름만 채움
            setBanner((cur) => {
              if (cur && cur.kind === "boss" && performance.now() - cur.shownAt < 1500) {
                return { ...cur, sub: name ?? cur.sub };
              }
              const id = ++fxIdRef.current;
              window.setTimeout(() => setBanner((c) => (c?.id === id ? null : c)), 2000);
              return { id, kind: "boss", kicker: "Boss", title: name ?? "BOSS", sub: "보스 출현", shownAt: performance.now() };
            });
            break;
          }
          case "boss_kill":
            showBanner({
              kind: "bossdown",
              kicker: "Boss Defeated",
              title: "보스 처치",
              sub: lastLog(/보스 처치/)?.replace(/^보스 처치!\s*/, ""),
            });
            break;
          case "wave_clear":
            showBanner({
              kind: "clear",
              kicker: `Wave ${eng.wave}`,
              title: "CLEAR",
              sub: lastLog(/클리어/)?.replace(/^웨이브 [\d~]+ 클리어!\s*/, ""),
            });
            break;
          case "leak":
            setLeakKey((k) => k + 1);
            viewRef.current.shakeUntil = performance.now() + 300;
            break;
          case "mission_success":
            toast(lastLog(/미션 성공/)?.replace(/^🎯\s*/, "") ?? "미션 성공", "target", "#c4a1ff");
            break;
          case "mission_fail":
            toast(lastLog(/미션 실패/)?.replace(/^✖\s*/, "") ?? "미션 실패", "target", "#ff6b6b");
            break;
          case "early_call":
            toast(lastLog(/조기 호출/)?.replace(/^⏩\s*/, "") ?? "조기 호출", "fast", "#5ee8e0");
            break;
        }
      }
    },
    [showBanner, toast]
  );
  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  // 게임 루프
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastVersion = -1;
    let lastUiRefresh = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const eng = engineRef.current;
      const canvas = canvasRef.current;
      if (!eng || !canvas) return;

      const dt = (now - last) / 1000;
      last = now;
      eng.tick(dt);
      const evs = eng.drainEvents();
      if (evs.length > 0) {
        getSound()?.playAll(evs);
        handleEventsRef.current(evs, eng);
      }

      const view = viewRef.current;
      view.now = now;
      view.dpr = dpr;
      view.tileSize = tileSize;
      view.selectedUid = selectedUid;
      view.placingUid =
        benchDragUidRef.current ??
        (selectedUid && eng.bench.some((b) => b.uid === selectedUid) ? selectedUid : null);
      view.fusionCandidates = fusionCandidates;
      view.fusionTargetUid = fusionTargetUid;
      if (aimSkillIndex !== null && eng.job) {
        const s = eng.job.skills[aimSkillIndex];
        view.aimRadius =
          s?.kind === "active" && s.effect.type === "damage_area" ? s.effect.radius : null;
      } else {
        view.aimRadius = null;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGame(ctx, eng, view);
      }

      // 매 프레임: 스킬 쿨다운 그림자, 보스 체력 바 (React 리렌더 없이 부드럽게)
      const root = rootRef.current;
      if (root && eng.job) {
        root.querySelectorAll<HTMLElement>("[data-skill-index]").forEach((el) => {
          const idx = Number(el.dataset.skillIndex);
          const skill = eng.job!.skills[idx];
          if (!skill || skill.kind !== "active") return;
          const left = eng.jobSkillCooldownLeft(idx);
          el.style.setProperty("--cd", String(skill.cooldown > 0 ? Math.min(1, left / skill.cooldown) : 0));
        });
      }
      if (root) {
        const boss = eng.enemies.find((e) => e.isBoss && !e.dead && !e.reached);
        if (boss) {
          const w = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
          root.querySelectorAll<HTMLElement>("[data-boss-hp]").forEach((el) => (el.style.width = w));
        }
      }

      // 버전 변경 또는 150ms 주기(쿨다운/마나/hover 정보)로 UI 갱신
      if (eng.version !== lastVersion || now - lastUiRefresh > 150) {
        lastVersion = eng.version;
        lastUiRefresh = now;
        setUiTick((v) => v + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selectedUid, fusionTargetUid, fusionCandidates, aimSkillIndex, tileSize, dpr]);

  /** 화면 좌표 → 엔진 좌표 (float: 타일 중심이 정수, tile: 칸 번호) — 회전 반영 */
  const posFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): { tile: Point; float: Point } => {
      const canvas = canvasRef.current;
      const eng = engineRef.current;
      if (!canvas || !eng) return { tile: { x: -1, y: -1 }, float: { x: -9, y: -9 } };
      const rect = canvas.getBoundingClientRect();
      const rot = viewRef.current.rotated;
      const dims = displaySize(eng.map, rot);
      const u = ((e.clientX - rect.left) / rect.width) * dims.cols;
      const v = ((e.clientY - rect.top) / rect.height) * dims.rows;
      const float = screenToMap(eng.map, rot, u, v);
      return { tile: { x: Math.round(float.x), y: Math.round(float.y) }, float };
    },
    []
  );

  const clearFusion = () => {
    setFusionTargetUid(null);
    setFusionPopoverPos(null);
  };

  // ---- 탭 (선택/배치/합성 대상/스킬 시전) ----
  const handleTap = (tile: Point, float: Point, client?: { x: number; y: number }) => {
    if (!engine) return;

    if (aimSkillIndex !== null) {
      if (engine.castJobSkill(aimSkillIndex, float)) setAimSkillIndex(null);
      return;
    }

    const selectedBench = selectedUid && engine.bench.some((b) => b.uid === selectedUid);
    if (selectedBench && engine.isTileBuildable(tile.x, tile.y)) {
      if (engine.placeTower(selectedUid!, tile.x, tile.y)) {
        setSelectedUid(null);
        clearFusion();
      }
      return;
    }

    const clicked = engine.placed.find(
      (t) => t.tile && t.tile.x === tile.x && t.tile.y === tile.y
    );
    if (clicked) {
      if (selectedUid && fusionCandidates.has(clicked.uid)) {
        if (clicked.uid === fusionTargetUid) {
          clearFusion();
        } else {
          setFusionTargetUid(clicked.uid);
          setFusionPopoverPos(client ?? null);
        }
      } else if (clicked.uid === selectedUid) {
        setSelectedUid(null);
        clearFusion();
      } else {
        setSelectedUid(clicked.uid);
        clearFusion();
      }
    } else {
      setSelectedUid(null);
      clearFusion();
    }
  };

  // ---- 포인터 이벤트 (마우스 + 터치 공용) ----
  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  /** 유닛 빠른 메뉴 열기 (선택 상태로 만들어 사거리/합성 후보도 함께 표시) */
  const openUnitMenu = (uid: string, x: number, y: number) => {
    setSelectedUid(uid);
    clearFusion();
    menuBackdropDownRef.current = false;
    setUnitMenu({ uid, x, y });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 우클릭 등 보조 버튼은 탭/드래그로 처리하지 않음 (우클릭 = 빠른 메뉴)
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { tile } = posFromEvent(e);
    let uid: string | null = null;
    if (engine && aimSkillIndex === null) {
      const tower = engine.placed.find(
        (t) => t.tile && t.tile.x === tile.x && t.tile.y === tile.y
      );
      uid = tower?.uid ?? null;
    }
    pointerRef.current = { startX: e.clientX, startY: e.clientY, uid, moved: false };

    // 터치 롱프레스 → 빠른 메뉴 (마우스는 우클릭으로)
    clearLongPress();
    if (uid && e.pointerType !== "mouse") {
      const { clientX, clientY } = e;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        const p = pointerRef.current;
        if (!p || p.moved || p.uid !== uid) return;
        p.longPressed = true;
        navigator.vibrate?.(15);
        openUnitMenu(uid!, clientX, clientY);
      }, 450);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!engine || aimSkillIndex !== null) return;
    const { tile } = posFromEvent(e);
    const tower = engine.placed.find(
      (t) => t.tile && t.tile.x === tile.x && t.tile.y === tile.y
    );
    if (tower) openUnitMenu(tower.uid, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { tile, float } = posFromEvent(e);
    viewRef.current.hoverTile = tile;
    hoverFloatRef.current = float;

    const p = pointerRef.current;
    if (!p) return;
    const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    if (p.uid && !p.longPressed && (p.moved || dist > 10)) {
      clearLongPress();
      p.moved = true;
      viewRef.current.dragUid = p.uid;
      viewRef.current.dragPos = float;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerRef.current;
    pointerRef.current = null;
    clearLongPress();
    viewRef.current.dragUid = null;
    viewRef.current.dragPos = null;
    if (!engine || !p || p.longPressed) return;

    const { tile, float } = posFromEvent(e);
    if (p.moved && p.uid) {
      const unit = engine.placed.find((t) => t.uid === p.uid);
      const same = unit?.tile && unit.tile.x === tile.x && unit.tile.y === tile.y;
      if (!same) engine.moveTower(p.uid, tile.x, tile.y);
    } else {
      handleTap(tile, float, { x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerCancel = () => {
    clearLongPress();
    pointerRef.current = null;
    viewRef.current.dragUid = null;
    viewRef.current.dragPos = null;
    viewRef.current.hoverTile = null;
    hoverFloatRef.current = null;
  };

  const handleBenchClick = (uid: string, e?: React.MouseEvent) => {
    if (!engine) return;
    // 드래그로 배치한 직후의 클릭은 무시
    if (suppressBenchClickRef.current === uid) {
      suppressBenchClickRef.current = null;
      return;
    }
    if (selectedUid && fusionCandidates.has(uid)) {
      if (uid === fusionTargetUid) {
        clearFusion();
      } else {
        setFusionTargetUid(uid);
        // 클릭한 카드 위쪽에 popover 표시
        const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect();
        setFusionPopoverPos(rect ? { x: rect.left + rect.width / 2, y: rect.top } : null);
      }
    } else if (uid === selectedUid) {
      setSelectedUid(null);
      clearFusion();
    } else {
      setSelectedUid(uid);
      clearFusion();
    }
  };

  // ---- 대기석 카드 드래그 → 맵에 최초 배치 ----
  const handleBenchDragStart = (uid: string, e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!engine || !engine.bench.some((b) => b.uid === uid)) return;
    const defId = engine.bench.find((b) => b.uid === uid)!.defId;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    let longPressed = false;

    // 터치 롱프레스 → 빠른 메뉴 (드래그가 시작되면 취소)
    clearLongPress();
    if (e.pointerType !== "mouse") {
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        if (active) return;
        longPressed = true;
        suppressBenchClickRef.current = uid;
        navigator.vibrate?.(15);
        openUnitMenu(uid, startX, startY);
      }, 450);
    }

    const onMove = (ev: PointerEvent) => {
      if (longPressed) return;
      if (!active && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        active = true;
        clearLongPress();
        benchDragUidRef.current = uid;
      }
      if (!active) return;
      setBenchGhost({ x: ev.clientX, y: ev.clientY, defId });
      // 캔버스 위 타일 하이라이트
      const eng = engineRef.current;
      if (eng) {
        const { tile } = posFromEvent(ev);
        viewRef.current.hoverTile =
          tile.x >= 0 && tile.y >= 0 && tile.x < eng.map.cols && tile.y < eng.map.rows ? tile : null;
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearLongPress();
      benchDragUidRef.current = null;
      setBenchGhost(null);
      if (longPressed) {
        // 롱프레스 뒤 click이 안 오는 브라우저도 있으므로 억제 플래그를 잠시 후 해제
        window.setTimeout(() => {
          if (suppressBenchClickRef.current === uid) suppressBenchClickRef.current = null;
        }, 400);
        return;
      }
      if (!active) return; // 드래그가 아니었으면 클릭으로 처리
      suppressBenchClickRef.current = uid;
      const eng = engineRef.current;
      if (!eng) return;
      const { x, y } = posFromEvent(ev).tile;
      if (eng.isTileBuildable(x, y)) {
        eng.placeTower(uid, x, y);
        if (selectedUid === uid) setSelectedUid(null);
        clearFusion();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const doFuse = () => {
    if (!engine || !selectedUid || !fusionTargetUid) return;
    const before = engine.towerDefs.get(engine.findUnit(selectedUid)?.defId ?? "");
    const result = engine.fuseUnits(selectedUid, fusionTargetUid);
    if (!result) return;
    setSelectedUid(null);
    clearFusion();
    const jumps = before ? GRADE_ORDER.indexOf(result.grade) - GRADE_ORDER.indexOf(before.grade) : 1;
    if (jumps >= 2) {
      showBanner({ kind: "jackpot", kicker: "Fusion Jackpot", title: "대성공!", sub: `${GRADE_LABEL[result.grade]} ${result.name}`, unit: result });
    } else if (result.grade === "legendary") {
      showBanner({ kind: "legend", kicker: "Legendary", title: result.name, sub: "전설 캐릭터 합성", unit: result });
    } else {
      toast(`합성 — ${GRADE_LABEL[result.grade]} ${result.name}`, "sparkles", GRADE_COLOR[result.grade]);
    }
  };

  /** 뽑기 실행 + 결과 연출 */
  const doGacha = (gachaId: string, region?: string) => {
    if (!engine) return;
    const result = engine.buyGacha(gachaId, region);
    if (!result) {
      const reason = engine.bench.length >= BENCH_SIZE ? "대기석이 가득 찼습니다" : engine.logs[engine.logs.length - 1]?.text;
      toast(reason ?? "소환할 수 없습니다", "info", "#ff6b6b");
      return;
    }
    setLastGacha({ id: gachaId, region });
    if (result.grade === "legendary") {
      showBanner({ kind: "legend", kicker: "Legendary", title: result.name, sub: result.regions.join(" · "), unit: result });
    } else {
      toast(`${GRADE_LABEL[result.grade]} ${result.name}`, "gem", GRADE_COLOR[result.grade]);
    }
  };

  const sellUnit = (uid: string) => {
    if (!engine) return false;
    const def = engine.towerDefs.get(engine.findUnit(uid)?.defId ?? "");
    const ok = engine.sellTower(uid);
    if (ok && def) toast(`${def.name} 판매 +${sellRefund(def.grade)}G`, "coin", "#e6c274");
    return ok;
  };

  const castSkill = (index: number) => {
    if (!engine?.job) return;
    const skill = engine.job.skills[index];
    if (skill?.kind !== "active") return;
    if (skill.effect.type === "damage_area") {
      setAimSkillIndex(aimSkillIndex === index ? null : index);
    } else if (engine.castJobSkill(index)) {
      toast(`${skill.name}!`, "sparkles", "#5ee8e0");
    }
  };

  const togglePause = useCallback((open?: boolean) => {
    const eng = engineRef.current;
    if (!eng || eng.phase === "victory" || eng.phase === "defeat") return;
    const next = open ?? !eng.paused;
    eng.paused = next;
    setPauseOpen(next);
    setUiTick((v) => v + 1);
  }, []);

  const exitToLobby = () => {
    saveNow();
    router.push("/");
  };

  const retry = () => {
    const url = `/game?chapter=${encodeURIComponent(chapterId)}&stage=${encodeURIComponent(stageId)}&job=${encodeURIComponent(jobId)}&diff=${diff}`;
    window.location.assign(url);
  };

  // ---- 키보드: W 회수 / F 판매 / Space 웨이브 / Esc 메뉴 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        if (unitMenu) setUnitMenu(null);
        else if (shopOpen) setShopOpen(false);
        else if (sheet !== "none") setSheet("none");
        else if (aimSkillIndex !== null) setAimSkillIndex(null);
        else togglePause();
        return;
      }
      if (eng.paused) return;
      if (key === " " || e.code === "Space") {
        if (eng.canStartWave() || eng.canCallWaveEarly()) {
          e.preventDefault();
          eng.startWave();
        }
        return;
      }
      if (!selectedUid) return;
      if (key === "w") {
        if (eng.unplaceTower(selectedUid)) {
          setSelectedUid(null);
          clearFusion();
        }
      } else if (key === "f") {
        if (sellUnit(selectedUid)) {
          setSelectedUid(null);
          clearFusion();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUid, unitMenu, shopOpen, sheet, aimSkillIndex, togglePause]);

  const regionColor = useMemo(
    () => new Map((data?.synergies ?? []).map((s) => [s.region, s.color ?? "#cfa24e"])),
    [data]
  );
  const shopRegions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.synergies.forEach((s) => set.add(s.region));
    data.towers.forEach((t) => t.regions.forEach((r) => set.add(r)));
    return Array.from(set).map((name) => ({ name, color: regionColor.get(name) ?? "#cfa24e" }));
  }, [data, regionColor]);

  const gold = useTweenedNumber(engine?.gold ?? 0, 380);
  const livesPulse = useChangePulse(engine?.lives ?? 0);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-arkesia p-4">
        <div className="frame max-w-sm p-6 text-center">
          <Icon name="info" className="mx-auto text-3xl text-blood-400" />
          <p className="mt-2 text-parchment-100">{error}</p>
          <button className="btn-gold mt-4 h-10 px-5 text-sm" onClick={() => router.push("/")}>
            <Icon name="home" /> 로비로
          </button>
        </div>
      </div>
    );
  }
  if (!data || !engine) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-arkesia">
        <Sigil className="h-24 w-24 animate-[spin_6s_linear_infinite] text-gold-400/70" />
        <p className="font-display text-xs tracking-[0.4em] text-gold-400/80">PREPARING</p>
      </div>
    );
  }

  // ---- 파생 상태 ----
  const selectedUnit = selectedUid ? engine.findUnit(selectedUid) : null;
  const selectedDef = selectedUnit ? engine.towerDefs.get(selectedUnit.defId) : null;
  const selectedIsPlaced = !!selectedUnit?.tile;
  const fusionTargetDef = fusionTargetUid
    ? engine.towerDefs.get(engine.findUnit(fusionTargetUid)?.defId ?? "")
    : null;
  const activeSkills = engine.activeJobSkills();
  const passiveSkills = engine.job?.skills.filter((s) => s.kind === "passive") ?? [];
  const bossInfo = engine.bossPreview();
  const nextWavePreview =
    engine.phase === "prep" && engine.wave < engine.totalWaves
      ? engine.wavePreview(engine.wave + 1)
      : [];
  const finished = engine.phase === "victory" || engine.phase === "defeat";
  const remainingEnemies =
    engine.phase === "wave"
      ? engine.enemies.filter((e) => !e.dead && !e.reached).length + engine.pendingSpawns
      : 0;

  // 미션: 전투 중이면 진행 중 미션, 준비 단계면 다음 웨이브에 배정될 미션
  const missionInfo: MissionInfo | null = (() => {
    if (engine.phase === "wave" && engine.mission) {
      const def = engine.currentMissionDef();
      if (!def) return null;
      const m = engine.mission;
      const c = def.condition;
      let progress = "";
      if (m.status === "active") {
        if (c.type === "clear_within" || (c.type === "boss_within" && m.bossKilledAt === undefined)) {
          progress = `남은 ${Math.max(0, Math.ceil(c.seconds - (engine.time - m.startTime)))}초`;
        } else if (c.type === "boss_within") {
          progress = "보스 처치 완료 — 전멸 시 성공";
        } else if (c.type === "max_placed") {
          progress = `배치 ${engine.placed.length}/${c.count}`;
        }
      }
      return { def, upcoming: false, failed: m.status === "failed", progress };
    }
    if (engine.phase === "prep" && engine.wave < engine.totalWaves) {
      const def = engine.missionFor(engine.wave + 1);
      if (!def) return null;
      const c = def.condition;
      const progress = c.type === "max_placed" ? `현재 배치 ${engine.placed.length}/${c.count}` : "";
      return { def, upcoming: true, failed: false, progress };
    }
    return null;
  })();

  // 소환 버튼 = 가장 최근에 사용한 뽑기 (없으면 첫 번째 뽑기)
  const quickGachaDef =
    (lastGacha ? engine.findGacha(lastGacha.id) : undefined) ??
    engine.gachaDefs.find((g) => g.regionMode !== "select") ??
    null;
  const quickGachaRegion = quickGachaDef?.regionMode === "select" ? lastGacha?.region : undefined;
  const quickGachaReady =
    !!quickGachaDef &&
    engine.canAffordGacha(quickGachaDef.id) &&
    engine.bench.length < BENCH_SIZE &&
    (quickGachaDef.regionMode !== "select" || !!quickGachaRegion);
  const quickCost = quickGachaDef ? gachaCost(quickGachaDef, engine.job) : 0;

  // hover 대상 (타워 or 적) — 정보 패널용
  const hoverTile = viewRef.current.hoverTile;
  const hoverFloat = hoverFloatRef.current;
  const hoverTower =
    hoverTile && viewRef.current.dragUid === null
      ? engine.placed.find((t) => t.tile && t.tile.x === hoverTile.x && t.tile.y === hoverTile.y)
      : undefined;
  let hoverEnemy: EnemyUnit | undefined;
  if (hoverFloat && !hoverTower) {
    let best = 0.6;
    for (const e of engine.enemies) {
      const d = Math.hypot(e.pos.x - hoverFloat.x, e.pos.y - hoverFloat.y);
      if (d < best) {
        best = d;
        hoverEnemy = e;
      }
    }
  }

  // ---- 재사용 UI 조각 ----

  const canCallEarly = engine.canCallWaveEarly();
  const waveButton = (cls: string) =>
    canCallEarly ? (
      <button
        className={`btn-ark animate-ark-pulse ${cls}`}
        title="남은 적이 많을수록 보너스가 큽니다. 클리어 보상은 적 전멸 시 합산(이자는 1회), 조기 호출한 웨이브에는 미션이 붙지 않습니다."
        onClick={() => engine.startWave()}
      >
        <Icon name="fast" className="text-lg" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-black">조기 호출</span>
          <span className="text-[11px] font-bold opacity-80">웨이브 {engine.wave + 1} · +{engine.earlyCallBonus()}G</span>
        </span>
      </button>
    ) : engine.phase === "wave" ? (
      <button className={`btn-ghost cursor-default ${cls}`} disabled>
        <Icon name="swords" className="text-lg text-gold-400" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-bold text-parchment-100">전투 중</span>
          <span className="text-[11px] text-parchment-400">남은 적 {remainingEnemies}</span>
        </span>
      </button>
    ) : (
      <button
        className={`btn-gold sheen ${engine.canStartWave() ? "animate-glow-pulse" : ""} ${cls}`}
        disabled={!engine.canStartWave()}
        onClick={() => engine.startWave()}
      >
        <Icon name={engine.isBossWave(engine.wave + 1) ? "crown" : "play"} className="text-lg" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-sm font-black">{engine.isBossWave(engine.wave + 1) ? "보스 웨이브" : "웨이브 시작"}</span>
          <span className="text-[11px] font-bold opacity-75">
            WAVE {engine.wave + 1}
            <span className="hidden lg:inline"> · Space</span>
          </span>
        </span>
      </button>
    );

  const summonButton = (cls: string) => (
    <button
      className={`btn-gold ${cls}`}
      disabled={!quickGachaReady}
      onClick={() => quickGachaDef && doGacha(quickGachaDef.id, quickGachaRegion)}
      title={
        quickGachaDef
          ? `${quickGachaDef.name}${quickGachaRegion ? ` [${quickGachaRegion}]` : ""} 1회 (${quickCost}G)`
          : ""
      }
    >
      <Icon name="gem" className="text-lg" />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-sm font-black">소환</span>
        <span className="flex items-center gap-0.5 text-[11px] font-bold opacity-80">
          <Icon name="coin" className="text-[#7a5418]" />
          {quickCost}
          {quickGachaRegion && <span className="ml-0.5 max-w-[4rem] truncate">· {quickGachaRegion}</span>}
        </span>
      </span>
    </button>
  );

  const shopButton = (cls: string) => (
    <button className={`btn-ghost ${cls}`} onClick={() => setShopOpen(true)} title="상점 — 소환 종류 선택">
      <Icon name="chest" className="text-lg text-gold-400" />
      <span className="text-[10px] font-bold text-parchment-300">상점</span>
    </button>
  );

  const unitActions = selectedUnit && selectedDef && (
    <div className="mt-2.5 space-y-1.5">
      {selectedIsPlaced && !fusionTargetUid && (
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(TARGET_MODE_LABEL) as TargetMode[]).map((m) => (
            <button
              key={m}
              className={`truncate rounded-md border px-0.5 py-1 text-[10px] font-bold transition duration-150 ${
                selectedUnit.targetMode === m
                  ? "border-gold-400/70 bg-gold-500/15 text-gold-200"
                  : "border-white/10 text-parchment-400 hover:border-white/25"
              }`}
              onClick={() => engine.setTargetMode(selectedUnit.uid, m)}
              title={`공격 대상: ${TARGET_MODE_LABEL[m]}`}
            >
              {TARGET_MODE_LABEL[m].replace(" 우선", "")}
            </button>
          ))}
        </div>
      )}
      {fusionCandidates.size > 0 && !fusionTargetUid && (
        <div className="flex items-center gap-1 text-[11px] text-gold-300">
          <Icon name="sparkles" /> 점선 표시된 같은 등급 유닛을 누르면 합성
        </div>
      )}
      <div className="flex gap-1.5">
        {selectedIsPlaced && (
          <button
            className="btn-ghost h-8 flex-1 text-[11px]"
            disabled={engine.bench.length >= BENCH_SIZE}
            onClick={() => {
              if (engine.unplaceTower(selectedUnit.uid)) {
                setSelectedUid(null);
                clearFusion();
              }
            }}
          >
            <Icon name="recall" /> 회수 <kbd className="hidden rounded bg-white/10 px-1 text-[9px] lg:inline">W</kbd>
          </button>
        )}
        <button
          className="btn-ghost h-8 flex-1 border-blood-500/30 text-[11px] text-blood-400 hover:border-blood-400/60 hover:text-blood-400"
          onClick={() => {
            if (sellUnit(selectedUnit.uid)) {
              setSelectedUid(null);
              clearFusion();
            }
          }}
        >
          <Icon name="coin" /> 판매 +{sellRefund(selectedDef.grade)}
          <kbd className="hidden rounded bg-white/10 px-1 text-[9px] lg:inline">F</kbd>
        </button>
      </div>
    </div>
  );

  // 정보 패널 내용 (우선순위: 적 hover > 다른 타워 hover > 선택 유닛)
  const infoContent = hoverEnemy ? (
    <EnemyDetail engine={engine} enemy={hoverEnemy} />
  ) : hoverTower && hoverTower.uid !== selectedUid ? (
    <TowerDetail engine={engine} unit={hoverTower} def={engine.towerDefs.get(hoverTower.defId)!} regionColor={regionColor} />
  ) : selectedUnit && selectedDef ? (
    <>
      <TowerDetail engine={engine} unit={selectedUnit} def={selectedDef} regionColor={regionColor} />
      {unitActions}
    </>
  ) : null;

  const waveRatio = engine.totalWaves > 0 ? engine.wave / engine.totalWaves : 0;
  const volIcon: IconName = volume === null || volume === 0 ? "volumeOff" : volume < 1 ? "volumeLow" : "volumeHigh";
  const cycleVolume = () => {
    const snd = getSound();
    if (!snd) return;
    snd.unlock();
    setVolume(snd.cycleVolume());
  };
  const toggleSpeed = () => {
    engine.speed = engine.speed === 1 ? 2 : 1;
    setUiTick((v) => v + 1);
  };
  const jobColor = engine.job?.appearance?.color ?? "#cfa24e";

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-arkesia bg-noise"
      onPointerDownCapture={() => getSound()?.unlock()}
    >
      {/* ===== 상단 HUD ===== */}
      <div className="relative z-30 flex h-14 shrink-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
        <button className="btn-ghost h-8 w-8 shrink-0 rounded-full sm:h-9 sm:w-9" onClick={exitToLobby} aria-label="로비로">
          <Icon name="chevronLeft" />
        </button>
        <div
          key={`lives-${livesPulse.key}`}
          className={`plate h-8 px-2 sm:h-9 sm:px-3 ${livesPulse.dir < 0 ? "animate-hit-flash border-blood-500/60" : ""}`}
          title="목숨"
        >
          <Icon name="heart" className="text-sm text-blood-400 sm:text-base" />
          <span className="font-display text-sm font-bold text-parchment-50 sm:text-base">{engine.lives}</span>
        </div>
        <div className="plate h-8 px-2 sm:h-9 sm:px-3" title="골드">
          <Icon name="coin" className="text-sm text-gold-400 sm:text-base" />
          <span className="min-w-[2.5ch] font-display text-sm font-bold text-gold-200 sm:text-base">{gold}</span>
        </div>

        {/* 웨이브 판 (데스크톱 가운데) */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center md:flex">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[10px] font-bold tracking-[0.35em] text-parchment-500">WAVE</span>
            <span className="font-display text-2xl font-black leading-none text-gold-grad">{engine.wave}</span>
            <span className="font-display text-sm font-bold text-parchment-500">/ {engine.totalWaves}</span>
          </div>
          <div className="relative mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-700 via-gold-500 to-gold-300 transition-[width] duration-700 ease-out-expo"
              style={{ width: `${waveRatio * 100}%` }}
            />
            {Array.from({ length: engine.totalWaves }, (_, i) => i + 1)
              .filter((w) => engine.isBossWave(w))
              .map((w) => (
                <span
                  key={w}
                  className="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-blood-400"
                  style={{ left: `${(w / engine.totalWaves) * 100}%`, opacity: w <= engine.wave ? 0.4 : 0.9 }}
                />
              ))}
          </div>
          <div className="mt-0.5 h-3 text-[10px] text-parchment-500">
            {engine.phase === "wave" ? `남은 적 ${remainingEnemies}` : engine.stage?.name}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {/* 모바일 웨이브 표시 */}
          <div className="plate h-8 gap-1 px-2 md:hidden">
            <span className="font-display text-[9px] font-bold tracking-[0.2em] text-parchment-500">WAVE</span>
            <span className="font-display text-sm font-black text-gold-200">
              {engine.wave}
              <span className="text-parchment-500">/{engine.totalWaves}</span>
            </span>
          </div>
          <button
            className={`btn-ghost h-8 gap-0.5 px-2 text-xs font-bold sm:h-9 sm:gap-1 sm:px-2.5 ${engine.speed > 1 ? "border-gold-400/70 text-gold-200" : ""}`}
            onClick={toggleSpeed}
            aria-label="게임 속도"
          >
            <Icon name="fast" />×{engine.speed}
          </button>
          <button className="btn-ghost hidden h-9 w-9 lg:inline-flex" onClick={cycleVolume} aria-label="효과음">
            <Icon name={volIcon} />
          </button>
          <button className="btn-ghost hidden h-9 w-9 lg:inline-flex" onClick={() => setSheet("log")} aria-label="전투 기록">
            <Icon name="log" />
          </button>
          <button className="btn-ghost h-8 w-8 sm:h-9 sm:w-9" onClick={() => togglePause(true)} aria-label="일시정지">
            <Icon name="pause" />
          </button>
        </div>
      </div>

      {/* ===== 본문: 좌 패널 | 전장 | 우 패널 ===== */}
      <div className="flex min-h-0 flex-1">
        {/* ---- 좌측 (데스크톱): 직업 / 시너지 ---- */}
        <aside className="hidden w-64 shrink-0 flex-col gap-3 overflow-y-auto p-3 pt-1 lg:flex">
          {engine.job && (
            <div className="frame p-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center text-2xl"
                  style={{
                    clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                    background: `linear-gradient(160deg, ${jobColor}, #0e131e 85%)`,
                  }}
                >
                  {engine.job.appearance?.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-parchment-500">
                    {engine.job.group && <Icon name={JOB_GROUP_ICON[engine.job.group] ?? "hex"} />}
                    {engine.job.group ?? "직업"}
                  </div>
                  <div className="truncate font-serif text-base font-bold text-parchment-50">{engine.job.name}</div>
                  {engine.job.synergyRegion && (
                    <div className="text-[10px] font-bold" style={{ color: regionColor.get(engine.job.synergyRegion) ?? "#cfa24e" }}>
                      {engine.job.synergyRegion} 시너지 +1
                    </div>
                  )}
                </div>
              </div>
              {passiveSkills.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  {passiveSkills.map((s, i) => (
                    <div key={i} className="rounded-md bg-ink-950/50 px-2 py-1 text-[11px]">
                      <span className="font-bold text-ark-300">{s.name}</span>{" "}
                      <span className="text-parchment-400">{s.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="frame min-h-0 flex-1 p-3">
            <div className="frame-title mb-2">Synergy</div>
            <SynergyRows synergies={engine.activeSynergies} />
          </div>
        </aside>

        {/* ---- 전장 ---- */}
        <div ref={areaRef} className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative rounded-xl border border-gold-500/25 bg-ink-950 p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95),0_0_0_1px_rgba(0,0,0,0.6)]">
              <div className="pointer-events-none absolute -inset-px rounded-xl [background:linear-gradient(180deg,rgba(230,194,116,0.18),transparent_30%,transparent_70%,rgba(230,194,116,0.12))]" />
              <canvas
                ref={canvasRef}
                width={Math.round(displaySize(engine.map, rotated).cols * tileSize * dpr)}
                height={Math.round(displaySize(engine.map, rotated).rows * tileSize * dpr)}
                style={{
                  width: displaySize(engine.map, rotated).cols * tileSize,
                  height: displaySize(engine.map, rotated).rows * tileSize,
                  touchAction: "none",
                }}
                className={`relative block rounded-lg ${aimSkillIndex !== null ? "cursor-crosshair" : "cursor-pointer"}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerLeave={handlePointerCancel}
                onContextMenu={handleContextMenu}
              />
              {/* 목숨을 잃으면 가장자리가 붉게 번쩍임 */}
              {leakKey > 0 && (
                <div
                  key={leakKey}
                  className="pointer-events-none absolute inset-1.5 rounded-lg"
                  style={{
                    boxShadow: "inset 0 0 60px 10px rgba(229,72,77,0.55)",
                    animation: "fade-out 700ms cubic-bezier(0.7,0,0.84,0) forwards",
                  }}
                />
              )}
            </div>
          </div>

          <ToastStack toasts={toasts} />
          <BannerLayer banner={banner} />

          {/* 조준 안내 */}
          {aimSkillIndex !== null && (
            <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 animate-pop-in whitespace-nowrap rounded-full border border-[#ff9d4d]/50 bg-ink-950/90 px-3 py-1.5 text-xs font-bold text-[#ffb27a] backdrop-blur">
              <Icon name="target" className="mr-1 inline" />
              맵을 눌러 시전 · 스킬 버튼을 다시 누르면 취소
            </div>
          )}

          {/* 모바일: 좌상단 시너지 칩 */}
          <div className="absolute left-1.5 top-1.5 z-20 flex max-h-[55%] flex-col items-start gap-1 overflow-y-auto lg:hidden">
            <SynergyChips synergies={engine.activeSynergies} onOpen={() => setSheet("synergy")} />
          </div>

          {/* 모바일: 우상단 미션 */}
          {missionInfo && (
            <div
              className={`absolute right-1.5 top-1.5 z-20 max-w-[46%] rounded-xl border px-2 py-1 text-[10px] backdrop-blur lg:hidden ${
                missionInfo.failed ? "border-blood-500/40 bg-ink-950/85 text-blood-400" : "border-[#a78bfa]/40 bg-ink-950/85 text-[#d9c4ff]"
              }`}
            >
              <div className="flex items-center gap-1 truncate font-bold">
                <Icon name="target" className="shrink-0" />
                <span className="truncate">{missionInfo.def.name}</span>
                <span className={missionInfo.failed ? "" : "text-gold-300"}>
                  {missionInfo.failed ? "실패" : `+${missionInfo.def.rewardGold}`}
                </span>
              </div>
              {missionInfo.progress && <div className="truncate text-parchment-400">{missionInfo.progress}</div>}
            </div>
          )}

          {/* 모바일: 우하단 원형 직업 스킬 */}
          {activeSkills.length > 0 && (
            <div className="absolute bottom-2 right-2 z-20 flex flex-col gap-2 lg:hidden">
              {activeSkills.map(({ index, skill }) => (
                <SkillButton
                  key={index}
                  skill={skill}
                  index={index}
                  cdLeft={engine.jobSkillCooldownLeft(index)}
                  usesLeft={engine.jobSkillUsesLeft}
                  aiming={aimSkillIndex === index}
                  icon={engine.job?.appearance?.icon}
                  color={jobColor}
                  variant="round"
                  onClick={() => castSkill(index)}
                />
              ))}
            </div>
          )}

          {/* 모바일: 보스전 체력 바 */}
          {bossInfo?.alive && !selectedUnit && (
            <div className="absolute bottom-2 left-2 right-[4.5rem] z-20 animate-fade-rise rounded-xl border border-blood-500/30 bg-ink-950/85 px-2.5 py-1.5 backdrop-blur lg:hidden">
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <Icon name="crown" className="text-blood-400" />
                <span className="truncate text-parchment-100">{bossInfo.def.name}</span>
                <span className="ml-auto shrink-0 text-parchment-400">
                  {Math.max(0, Math.round(bossInfo.alive.hp)).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  data-boss-hp
                  className="h-full rounded-full bg-gradient-to-r from-blood-600 to-blood-400"
                  style={{ width: `${Math.max(0, (bossInfo.alive.hp / bossInfo.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* 모바일: 선택 유닛 정보 카드 (빠른 메뉴가 열려 있으면 숨김) */}
          {selectedUnit && selectedDef && !unitMenu && (
            <div className="frame absolute bottom-2 left-2 right-[4.5rem] z-20 max-w-md animate-fade-rise p-2.5 lg:hidden">
              <button
                className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-parchment-400"
                onClick={() => {
                  setSelectedUid(null);
                  clearFusion();
                }}
                aria-label="닫기"
              >
                <Icon name="close" />
              </button>
              <TowerDetail engine={engine} unit={selectedUnit} def={selectedDef} regionColor={regionColor} compact />
              {unitActions}
            </div>
          )}
        </div>

        {/* ---- 우측 (데스크톱): 정보 / 보스 / 다음 웨이브 / 미션 ---- */}
        <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto p-3 pt-1 lg:flex">
          <div className="frame p-3">
            <div className="frame-title mb-2.5">
              {hoverEnemy ? "Enemy" : infoContent ? "Unit" : "Guide"}
            </div>
            {infoContent ?? (
              <ul className="space-y-1.5 text-xs text-parchment-400">
                <li className="flex gap-2">
                  <Icon name="gem" className="mt-0.5 shrink-0 text-gold-400" />
                  <span>
                    <b className="text-parchment-100">소환</b>으로 캐릭터를 얻고 대기석에서 맵으로 끌어다 배치하세요
                  </span>
                </li>
                <li className="flex gap-2">
                  <Icon name="sparkles" className="mt-0.5 shrink-0 text-gold-400" />
                  <span>
                    같은 등급 둘을 <b className="text-parchment-100">합성</b>하면 상위 등급이 됩니다
                  </span>
                </li>
                <li className="flex gap-2">
                  <Icon name="hex" className="mt-0.5 shrink-0 text-gold-400" />
                  <span>
                    같은 지역 캐릭터를 모으면 <b className="text-parchment-100">시너지</b>가 아군 전체를 강화합니다
                  </span>
                </li>
                <li className="flex gap-2">
                  <Icon name="target" className="mt-0.5 shrink-0 text-gold-400" />
                  <span>우클릭(모바일은 길게 누르기)으로 공격 대상·회수·판매</span>
                </li>
              </ul>
            )}
          </div>
          {bossInfo && <BossCard boss={bossInfo} />}
          {nextWavePreview.length > 0 && <NextWave wave={engine.wave + 1} preview={nextWavePreview} />}
          {missionInfo && <MissionCard info={missionInfo} wave={engine.wave + 1} />}
        </aside>
      </div>

      {/* ===== 하단 도크 (데스크톱) ===== */}
      <div className="relative z-30 hidden shrink-0 items-end gap-4 border-t border-gold-500/15 bg-ink-950/85 px-4 pb-3 pt-2.5 backdrop-blur lg:flex">
        <div className="flex items-end gap-2">
          {activeSkills.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="mb-1 text-[10px] text-parchment-500">
                남은 사용 <b className={engine.jobSkillUsesLeft > 0 ? "text-gold-300" : "text-blood-400"}>{engine.jobSkillUsesLeft}</b>
              </div>
              <div className="flex gap-2">
                {activeSkills.map(({ index, skill }) => (
                  <SkillButton
                    key={index}
                    skill={skill}
                    index={index}
                    cdLeft={engine.jobSkillCooldownLeft(index)}
                    usesLeft={engine.jobSkillUsesLeft}
                    aiming={aimSkillIndex === index}
                    icon={engine.job?.appearance?.icon}
                    color={jobColor}
                    variant="square"
                    onClick={() => castSkill(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-display text-[10px] font-bold tracking-[0.3em] text-gold-500/70">BENCH</span>
            <span className={`text-[11px] font-bold ${engine.bench.length >= BENCH_SIZE ? "text-blood-400" : "text-parchment-400"}`}>
              {engine.bench.length}/{BENCH_SIZE}
            </span>
          </div>
          <div className="flex gap-1.5">
            <BenchSlots
              engine={engine}
              units={engine.bench}
              capacity={BENCH_SIZE}
              size={tileSize >= 64 ? 58 : 50}
              selectedUid={selectedUid}
              fusionCandidates={fusionCandidates}
              fusionTargetUid={fusionTargetUid}
              onPointerDown={handleBenchDragStart}
              onClick={handleBenchClick}
              onContextMenu={(uid, e) => openUnitMenu(uid, e.clientX, e.clientY)}
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          {shopButton("h-14 w-14 flex-col gap-0.5")}
          {summonButton("h-14 min-w-[8.5rem] px-4")}
          {waveButton("h-14 min-w-[10.5rem] px-4")}
        </div>
      </div>

      {/* ===== 하단 도크 (모바일) ===== */}
      <div className="relative z-30 shrink-0 border-t border-gold-500/15 bg-ink-950/90 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1.5">
          <BenchSlots
            engine={engine}
            units={engine.bench}
            capacity={BENCH_SIZE}
            size={50}
            selectedUid={selectedUid}
            fusionCandidates={fusionCandidates}
            fusionTargetUid={fusionTargetUid}
            onPointerDown={handleBenchDragStart}
            onClick={handleBenchClick}
            onContextMenu={(uid, e) => openUnitMenu(uid, e.clientX, e.clientY)}
          />
        </div>
        <div className="flex gap-2">
          {shopButton("h-12 w-12 shrink-0 flex-col gap-0")}
          {summonButton("h-12 flex-1 px-3")}
          {waveButton("h-12 flex-[1.3] px-3")}
        </div>
      </div>

      {/* ===== 상점 ===== */}
      <Modal open={shopOpen} onClose={() => setShopOpen(false)} kicker="Summon" title="소환" width={460}>
        <ShopPanel
          engine={engine}
          regions={shopRegions}
          regionSel={gachaRegionSel}
          onRegionSel={setGachaRegionSel}
          onRoll={doGacha}
        />
      </Modal>

      {/* ===== 시너지 (모바일) ===== */}
      <Modal open={sheet === "synergy"} onClose={() => setSheet("none")} kicker="Synergy" title="지역 시너지">
        <SynergyDetailList synergies={engine.activeSynergies} />
      </Modal>

      {/* ===== 전투 기록 ===== */}
      <Modal open={sheet === "log"} onClose={() => setSheet("none")} kicker="Log" title="전투 기록">
        <div className="flex flex-col gap-1 text-xs">
          {[...engine.logs].reverse().map((l, i) => (
            <div key={i} className="rounded-md bg-ink-950/40 px-2 py-1" style={{ color: l.color ?? "#a9a08b" }}>
              {l.text}
            </div>
          ))}
        </div>
      </Modal>

      {/* ===== 일시정지 ===== */}
      <PauseMenu
        open={pauseOpen && !finished}
        volume={volume}
        speed={engine.speed}
        onResume={() => togglePause(false)}
        onCycleVolume={cycleVolume}
        onToggleSpeed={toggleSpeed}
        onOpenLog={() => setSheet("log")}
        onLobby={exitToLobby}
      />

      {/* ===== 합성 확인 ===== */}
      {fusionTargetUid && fusionTargetDef && selectedDef && fusionPopoverPos && (
        <FusionPopover
          engine={engine}
          a={selectedDef}
          b={fusionTargetDef}
          x={fusionPopoverPos.x}
          y={fusionPopoverPos.y}
          onFuse={doFuse}
          onCancel={clearFusion}
        />
      )}

      {/* ===== 유닛 빠른 메뉴 (터치 롱프레스 / 마우스 우클릭) ===== */}
      {unitMenu && (
        <>
          <div
            className="fixed inset-0 z-[66]"
            onPointerDown={() => (menuBackdropDownRef.current = true)}
            onClick={() => {
              if (menuBackdropDownRef.current) setUnitMenu(null);
              menuBackdropDownRef.current = false;
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setUnitMenu(null);
            }}
          />
          <UnitQuickMenu
            engine={engine}
            uid={unitMenu.uid}
            x={unitMenu.x}
            y={unitMenu.y}
            onClose={() => setUnitMenu(null)}
            onDone={() => {
              setSelectedUid(null);
              clearFusion();
            }}
          />
        </>
      )}

      {/* ===== 대기석 드래그 고스트 ===== */}
      {benchGhost && (
        <div
          className="pointer-events-none fixed z-[65] -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_10px_20px_rgba(0,0,0,0.7)]"
          style={{ left: benchGhost.x, top: benchGhost.y }}
        >
          {(() => {
            const def = engine.towerDefs.get(benchGhost.defId) as TowerDef | undefined;
            return def ? <GradeSlot grade={def.grade} appearance={def.appearance} size={52} selected /> : null;
          })()}
        </div>
      )}

      {/* ===== 결과 ===== */}
      {finished && <ResultOverlay engine={engine} onRetry={retry} onLobby={() => router.push("/")} />}
    </div>
  );
}
