"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BENCH_SIZE,
  DIFFICULTY,
  GRADE_COLOR,
  GRADE_LABEL,
  TARGET_MODE_LABEL,
  describeMissionCondition,
} from "@/game/constants";
import { GameEngine } from "@/game/engine";
import { gachaCost, sellRefund } from "@/game/gacha";
import { createViewState, drawGame, type ViewState } from "@/game/render";
import type {
  Difficulty,
  EnemyUnit,
  GameData,
  Point,
  TargetMode,
  TowerDef,
  TowerUnit,
} from "@/game/types";
import { fetchGameData } from "@/lib/api";
import { clearSave, loadSave, writeSave } from "@/lib/save";
import { getSound } from "@/lib/sound";
import UnitCard from "./UnitCard";

const TRAIT_LABEL: Record<string, string> = {
  regen: "재생",
  stealth: "은신",
  split: "분열",
  aura_defense: "방어 오라",
  slow_immune: "둔화 면역",
  stun_immune: "기절 면역",
};

export const SYNERGY_EFFECT_LABEL: Record<string, string> = {
  atk_pct: "공격력 %",
  magic_atk_pct: "마법 공격력 %",
  atk_speed_pct: "공격속도 %",
  crit_chance: "치명타 확률 %p",
  crit_damage_pct: "치명타 피해 %p",
  mana_regen_pct: "마나 회복 %",
  range_add: "사거리 +타일",
  gold_per_kill: "처치당 골드",
};

const PASSIVE_LABEL: Record<string, string> = {
  start_gold: "시작 골드",
  extra_lives: "목숨",
  gacha_discount_pct: "뽑기 할인 %",
  crit_chance_all: "치명타 확률 %p",
  atk_pct_all: "물리 공격력 %",
  magic_atk_pct_all: "마법 공격력 %",
  atk_speed_pct_all: "공격속도 %",
  crit_damage_pct_all: "치명타 피해 %p",
  mana_regen_pct_all: "마나 회복 %",
  gold_per_kill: "처치당 골드",
  fusion_jackpot_pct: "합성 대성공 %p",
};

/**
 * 게임 전투 화면
 * - 데스크톱(lg+): 좌우 사이드 패널로 여백 활용 (스케치 레이아웃)
 * - 모바일(<lg): 풀스크린 오버레이 + 바텀시트
 * - 마우스/터치 공용 포인터 이벤트
 */
export default function GameClient() {
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<ViewState>(createViewState(48));
  const hoverFloatRef = useRef<Point | null>(null);
  const shopBtnRef = useRef<HTMLButtonElement | null>(null);
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
  const [dpr, setDpr] = useState(1);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [fusionTargetUid, setFusionTargetUid] = useState<string | null>(null);
  const [aimSkillIndex, setAimSkillIndex] = useState<number | null>(null);
  const [gachaRegionSel, setGachaRegionSel] = useState<string>("");
  const [sheet, setSheet] = useState<"none" | "gacha" | "synergy" | "log">("none");
  const [shopOpen, setShopOpen] = useState(false);
  /** 가장 최근에 사용한 뽑기 (바로 뽑기 버튼에 표시) */
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

  useEffect(() => {
    setDpr(Math.min(2, window.devicePixelRatio || 1));
    setVolume(getSound()?.volume ?? 0);
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

  // 화면 크기에 맞춰 타일 크기 계산
  useEffect(() => {
    const el = areaRef.current;
    const eng = engineRef.current;
    if (!el || !eng) return;
    const compute = () => {
      const rect = el.getBoundingClientRect();
      const pad = 8;
      const ts = Math.max(
        16,
        Math.min((rect.width - pad) / eng.map.cols, (rect.height - pad) / eng.map.rows)
      );
      setTileSize(ts);
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
      getSound()?.playAll(eng.drainEvents());

      const view = viewRef.current;
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

  const posFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): { tile: Point; float: Point } => {
      const canvas = canvasRef.current;
      const eng = engineRef.current;
      if (!canvas || !eng) return { tile: { x: -1, y: -1 }, float: { x: 0, y: 0 } };
      const rect = canvas.getBoundingClientRect();
      const fx = ((e.clientX - rect.left) / rect.width) * eng.map.cols;
      const fy = ((e.clientY - rect.top) / rect.height) * eng.map.rows;
      return { tile: { x: Math.floor(fx), y: Math.floor(fy) }, float: { x: fx, y: fy } };
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
        setFusionPopoverPos(
          rect ? { x: rect.left + rect.width / 2, y: rect.top } : null
        );
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
      const canvas = canvasRef.current;
      const eng = engineRef.current;
      if (canvas && eng) {
        const rect = canvas.getBoundingClientRect();
        const fx = ((ev.clientX - rect.left) / rect.width) * eng.map.cols;
        const fy = ((ev.clientY - rect.top) / rect.height) * eng.map.rows;
        viewRef.current.hoverTile =
          fx >= 0 && fy >= 0 && fx < eng.map.cols && fy < eng.map.rows
            ? { x: Math.floor(fx), y: Math.floor(fy) }
            : null;
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
      const canvas = canvasRef.current;
      const eng = engineRef.current;
      if (!canvas || !eng) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - rect.left) / rect.width) * eng.map.cols);
      const y = Math.floor(((ev.clientY - rect.top) / rect.height) * eng.map.rows);
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
    if (engine.fuseUnits(selectedUid, fusionTargetUid)) {
      setSelectedUid(null);
      clearFusion();
    }
  };

  // ---- 키보드 단축키: W = 회수, F = 판매 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng || !selectedUid) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === "w") {
        if (eng.unplaceTower(selectedUid)) {
          setSelectedUid(null);
          clearFusion();
        }
      } else if (key === "f") {
        if (eng.sellTower(selectedUid)) {
          setSelectedUid(null);
          clearFusion();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUid]);

  // 빠른 메뉴: Esc로 닫기
  useEffect(() => {
    if (!unitMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUnitMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unitMenu]);

  /** 뽑기 실행 + 최근 뽑기 기록 */
  const doGacha = (gachaId: string, region?: string) => {
    if (!engine) return;
    const result = engine.buyGacha(gachaId, region);
    if (result) setLastGacha({ id: gachaId, region });
  };

  const regions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.synergies.forEach((s) => set.add(s.region));
    data.towers.forEach((t) => t.regions.forEach((r) => set.add(r)));
    return Array.from(set);
  }, [data]);

  if (error) {
    return (
      <div className="panel text-red-400">
        {error} — <Link href="/" className="underline">홈으로</Link>
      </div>
    );
  }
  if (!data || !engine) {
    return <div className="panel animate-pulse">게임 준비 중...</div>;
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
  const lastLog = engine.logs[engine.logs.length - 1];
  const bossInfo = engine.bossPreview();
  const nextWavePreview =
    engine.phase === "prep" && engine.wave < engine.totalWaves
      ? engine.wavePreview(engine.wave + 1)
      : [];
  const towerStats = engine.phase === "victory" || engine.phase === "defeat" ? engine.towerStats() : [];

  // 미션: 전투 중이면 진행 중 미션, 준비 단계면 다음 웨이브에 배정될 미션
  const missionInfo = (() => {
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

  const canCallEarly = engine.canCallWaveEarly();

  const waveButton = canCallEarly ? (
    <button
      className="whitespace-nowrap rounded-lg border-2 border-sky-400 bg-sky-500/90 px-4 py-1.5 text-sm font-extrabold text-slate-950 shadow-lg transition-transform active:scale-95"
      title="남은 적이 많을수록 보너스가 큽니다. 클리어 보상은 적 전멸 시 합산(이자는 1회), 조기 호출한 웨이브에는 미션이 붙지 않습니다."
      onClick={() => engine.startWave()}
    >
      ⏩ 웨이브 {engine.wave + 1} 조기 호출{" "}
      <span className="text-xs font-bold">+{engine.earlyCallBonus()}G</span>
    </button>
  ) : (
    <button
      className="whitespace-nowrap rounded-lg border-2 border-amber-500 bg-amber-500/90 px-5 py-1.5 text-sm font-extrabold text-slate-950 shadow-lg transition-transform active:scale-95 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
      disabled={!engine.canStartWave()}
      onClick={() => engine.startWave()}
    >
      {engine.phase === "wave"
        ? `웨이브 ${engine.wave} 진행 중`
        : engine.isBossWave(engine.wave + 1)
          ? `⚠ 보스 웨이브 ${engine.wave + 1} 시작`
          : `▶ 웨이브 ${engine.wave + 1} 시작`}
    </button>
  );

  // 바로 뽑기 = 가장 최근에 사용한 뽑기 (없으면 첫 번째 뽑기)
  const quickGachaDef =
    (lastGacha ? engine.findGacha(lastGacha.id) : undefined) ??
    engine.gachaDefs.find((g) => g.regionMode !== "select") ??
    null;
  const quickGachaRegion =
    quickGachaDef?.regionMode === "select" ? lastGacha?.region : undefined;
  const quickGachaReady =
    !!quickGachaDef &&
    engine.canAffordGacha(quickGachaDef.id) &&
    (quickGachaDef.regionMode !== "select" || !!quickGachaRegion);

  // hover 대상 (타워 or 적) — 정보 패널용
  const hoverTile = viewRef.current.hoverTile;
  const hoverFloat = hoverFloatRef.current;
  const hoverTower =
    hoverTile && viewRef.current.dragUid === null
      ? engine.placed.find(
          (t) => t.tile && t.tile.x === hoverTile.x && t.tile.y === hoverTile.y
        )
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

  const towerInfoBody = (unit: TowerUnit, def: TowerDef) => (
    <>
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
          style={{ backgroundColor: GRADE_COLOR[def.grade] }}
        >
          {GRADE_LABEL[def.grade]}
        </span>
        <span className="font-bold">
          {def.appearance.icon} {def.name}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">[{def.regions.join(", ")}]</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
        <span>⚔ 공격 {Math.round(engine.effectiveAtk(unit, def))}</span>
        <span>🔮 마공 {Math.round(engine.effectiveMagicAtk(unit, def))}</span>
        <span>⏱ {engine.effectiveAttackSpeed(unit, def).toFixed(2)}/s</span>
        <span>📏 {engine.effectiveRange(unit, def).toFixed(1)}</span>
        <span>
          💧 {Math.floor(unit.mana)}/{def.maxMana}
        </span>
        {unit.tile && <span>☠ 처치 {unit.kills}</span>}
      </div>
      <div className="mt-1.5 rounded bg-slate-900 px-1.5 py-1 text-[10px] text-amber-300/90">
        <b>{def.skill.name}</b> — {def.skill.description}
      </div>
    </>
  );

  const enemyInfoBody = (e: EnemyUnit) => {
    const def = engine.enemyDefs.get(e.defId);
    if (!def) return null;
    return (
      <>
        <div className="flex items-center gap-2">
          {e.isBoss && (
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
              보스
            </span>
          )}
          <span className="font-bold">
            {def.appearance.icon} {def.name}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
          <span className="col-span-2">
            ❤️ {Math.max(0, Math.round(e.hp))} / {e.maxHp}
          </span>
          <span>🛡 방어 {e.defense}</span>
          <span>✨ 마방 {e.magicDefense}</span>
          <span>👟 이속 {e.moveSpeed}</span>
          <span>💰 {e.goldReward}G</span>
        </div>
        {def.traits && def.traits.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {def.traits.map((tr, i) => (
              <span
                key={i}
                className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300"
                title={JSON.stringify(tr)}
              >
                {TRAIT_LABEL[tr.type] ?? tr.type}
                {tr.type === "regen" && ` ${tr.pctPerSec}%/s`}
                {tr.type === "stealth" && ` (${tr.revealRange}칸)`}
                {tr.type === "split" && ` ×${tr.count}`}
              </span>
            ))}
          </div>
        )}
        {def.description && (
          <div className="mt-1.5 text-[10px] text-slate-400">{def.description}</div>
        )}
      </>
    );
  };

  const unitActionButtons = selectedUnit && selectedDef && (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {selectedIsPlaced && !fusionTargetUid && (
        <label className="flex w-full items-center gap-1 text-[10px] text-slate-400">
          🎯 타겟
          <select
            className="input flex-1 py-0.5 text-[10px]"
            value={selectedUnit.targetMode}
            onChange={(e) => engine.setTargetMode(selectedUnit.uid, e.target.value as TargetMode)}
          >
            {(Object.keys(TARGET_MODE_LABEL) as TargetMode[]).map((m) => (
              <option key={m} value={m}>
                {TARGET_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      )}
      {fusionTargetUid && fusionTargetDef ? (
        <>
          <button className="btn btn-primary flex-1 py-1 text-[11px]" onClick={doFuse}>
            ⚗️ {fusionTargetDef.name}와(과) 합성
          </button>
          <button className="btn py-1 text-[11px]" onClick={clearFusion}>
            취소
          </button>
        </>
      ) : (
        <>
          {selectedIsPlaced && (
            <button
              className="btn flex-1 py-1 text-[11px]"
              onClick={() => {
                if (engine.unplaceTower(selectedUnit.uid)) setSelectedUid(null);
              }}
            >
              회수 <kbd className="rounded bg-slate-700 px-1 text-[9px]">W</kbd>
            </button>
          )}
          <button
            className="btn btn-danger flex-1 py-1 text-[11px]"
            onClick={() => {
              engine.sellTower(selectedUnit.uid);
              setSelectedUid(null);
              clearFusion();
            }}
          >
            판매 <kbd className="rounded bg-slate-800 px-1 text-[9px]">F</kbd>
          </button>
        </>
      )}
    </div>
  );

  const synergyList = (withTooltip: boolean) => (
    <div className="space-y-1.5">
      {engine.activeSynergies.length === 0 && (
        <p className="text-[11px] text-slate-500">타워를 배치하면 시너지가 표시됩니다.</p>
      )}
      {engine.activeSynergies.map((syn) => {
        const item = (
          <div
            className={`rounded border px-2 py-1 text-[11px] ${
              syn.activeTierIndex >= 0
                ? "border-slate-600 bg-slate-800/70"
                : "border-slate-800 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: syn.color }}>
                {syn.region} · {syn.name}
              </span>
              <span className="text-slate-300">
                {syn.tiers.map((t, i) => (
                  <span
                    key={t.count}
                    className={i === syn.activeTierIndex ? "font-bold text-amber-400" : ""}
                  >
                    {i > 0 && "/"}
                    {t.count}
                  </span>
                ))}
                <span className="ml-1 text-slate-500">({syn.count})</span>
              </span>
            </div>
            {syn.activeTierIndex >= 0 && (
              <div className="mt-0.5 text-[10px] text-amber-300/90">
                {syn.tiers[syn.activeTierIndex].effects
                  .map((e) => `${SYNERGY_EFFECT_LABEL[e.type] ?? e.type} +${e.value}`)
                  .join(", ")}
              </div>
            )}
          </div>
        );

        if (!withTooltip) return <div key={syn.synergyId}>{item}</div>;

        return (
          <HoverTip
            key={syn.synergyId}
            tip={
              <>
                <div className="font-bold" style={{ color: syn.color }}>
                  {syn.region} · {syn.name}
                </div>
                {syn.description && (
                  <p className="mt-1 text-[10px] text-slate-400">{syn.description}</p>
                )}
                <div className="mt-1.5 space-y-1">
                  {syn.tiers.map((tier, i) => (
                    <div
                      key={tier.count}
                      className={`rounded px-1.5 py-1 text-[10px] ${
                        i === syn.activeTierIndex
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      <b>{tier.count}명</b>:{" "}
                      {tier.effects
                        .map((e) => `${SYNERGY_EFFECT_LABEL[e.type] ?? e.type} +${e.value}`)
                        .join(", ")}
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[9px] text-slate-500">효과는 아군 전체 적용</p>
              </>
            }
          >
            {item}
          </HoverTip>
        );
      })}
    </div>
  );

  const jobSkillButton = (index: number, round: boolean) => {
    const skill = engine.job!.skills[index];
    if (skill.kind !== "active") return null;
    const cd = engine.jobSkillCooldownLeft(index);
    const usesLeft = engine.jobSkillUsesLeft;
    const exhausted = usesLeft <= 0;
    const needsAim = skill.effect.type === "damage_area";
    const aiming = aimSkillIndex === index;
    const onClick = () => {
      if (needsAim) setAimSkillIndex(aiming ? null : index);
      else engine.castJobSkill(index);
    };

    if (round) {
      // 모바일: 원형 버튼
      return (
        <button
          key={index}
          disabled={cd > 0 || exhausted}
          title={`${skill.name}: ${skill.description ?? ""} (남은 사용 ${usesLeft}회)`}
          onClick={onClick}
          className={`relative flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-[9px] font-bold backdrop-blur transition-transform active:scale-95 ${
            aiming
              ? "border-orange-400 bg-orange-500/30 text-orange-200"
              : cd > 0 || exhausted
                ? "border-slate-700 bg-slate-900/80 text-slate-500"
                : "border-amber-500 bg-slate-900/85 text-amber-300"
          }`}
        >
          <span className="text-base leading-none">{engine.job?.appearance?.icon ?? "✨"}</span>
          <span className="mt-0.5 max-w-full truncate px-1">{skill.name}</span>
          {/* 남은 사용 횟수 뱃지 */}
          <span
            className={`absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              exhausted ? "bg-red-600 text-slate-100" : "bg-amber-500 text-slate-950"
            }`}
          >
            {usesLeft}
          </span>
          {cd > 0 && !exhausted && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/60 text-sm font-bold text-slate-200">
              {Math.ceil(cd)}
            </span>
          )}
          {exhausted && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/70 text-[10px] font-bold text-red-400">
              소진
            </span>
          )}
        </button>
      );
    }

    // 데스크톱: hover 툴팁 있는 버튼
    return (
      <HoverTip
        key={index}
        tip={
          <>
            <div className="font-bold text-amber-300">{skill.name}</div>
            <div className="mt-0.5 text-slate-400">
              쿨다운 {skill.cooldown}초 · 남은 사용 {usesLeft}회
            </div>
            {skill.description && <p className="mt-1 text-slate-300">{skill.description}</p>}
            {skill.effect.type === "damage_area" && (
              <p className="mt-1 text-[10px] text-orange-400">
                버튼 클릭 후 맵을 클릭해 시전합니다.
              </p>
            )}
            {exhausted && (
              <p className="mt-1 text-[10px] text-red-400">
                사용 횟수를 모두 소진했습니다. (난이도별 제한)
              </p>
            )}
          </>
        }
      >
        <button
          disabled={cd > 0 || exhausted}
          onClick={onClick}
          className={`btn w-full py-1.5 text-left text-[11px] ${
            aiming ? "border-orange-500 bg-orange-500/20 text-orange-200" : ""
          }`}
        >
          <span className="font-bold">{skill.name}</span>
          {skill.effect.type === "damage_area" && !aiming && !exhausted && (
            <span className="ml-1 text-orange-400">🎯</span>
          )}
          {aiming && <span className="ml-1 text-orange-300">조준 중...</span>}
          <span className="float-right text-slate-400">
            {exhausted ? (
              <span className="text-red-400">소진</span>
            ) : cd > 0 ? (
              `${Math.ceil(cd)}s`
            ) : (
              `쿨 ${skill.cooldown}s`
            )}
          </span>
        </button>
      </HoverTip>
    );
  };

  const gachaButtons = (
    <div className="space-y-2">
      {engine.gachaDefs.map((g) => {
        const cost = gachaCost(g, engine.job);
        if (g.regionMode === "select") {
          return (
            <div key={g.id} className="flex gap-1.5">
              <select
                className="input flex-1"
                value={gachaRegionSel}
                onChange={(e) => setGachaRegionSel(e.target.value)}
              >
                <option value="">지역 선택...</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                className="btn whitespace-nowrap"
                disabled={!gachaRegionSel || !engine.canAffordGacha(g.id)}
                onClick={() => doGacha(g.id, gachaRegionSel)}
              >
                {g.name} <span className="text-amber-400">{cost}G</span>
              </button>
            </div>
          );
        }
        return (
          <button
            key={g.id}
            className="btn w-full py-2.5 text-left"
            disabled={!engine.canAffordGacha(g.id)}
            onClick={() => doGacha(g.id)}
          >
            {g.name}
            {g.regionMode === "fixed" && g.fixedRegion && (
              <span className="ml-1 text-slate-400">[{g.fixedRegion}]</span>
            )}
            {g.description && (
              <span className="block text-[10px] text-slate-500">{g.description}</span>
            )}
            <span className="float-right font-bold text-amber-400">{cost}G</span>
          </button>
        );
      })}
      <p className="text-center text-xs text-slate-500">
        보유 골드: <b className="text-amber-400">{engine.gold}G</b> · 대기석{" "}
        {engine.bench.length}/9
      </p>
    </div>
  );

  const benchCards = (
    <>
      {engine.bench.map((unit) => {
        const def = engine.towerDefs.get(unit.defId);
        if (!def) return null;
        return (
          <div
            key={unit.uid}
            className="shrink-0 touch-none"
            onPointerDown={(e) => handleBenchDragStart(unit.uid, e)}
            onClick={(e) => handleBenchClick(unit.uid, e)}
            onContextMenu={(e) => {
              e.preventDefault();
              openUnitMenu(unit.uid, e.clientX, e.clientY);
            }}
          >
            <UnitCard
              def={def}
              selected={selectedUid === unit.uid}
              fusionCandidate={fusionCandidates.has(unit.uid)}
              fusionSelected={fusionTargetUid === unit.uid}
            />
          </div>
        );
      })}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex select-none flex-col overflow-hidden bg-slate-950"
      onPointerDownCapture={() => getSound()?.unlock()}
    >
      {/* ===== 상단 HUD ===== */}
      <div className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-slate-800/60 bg-slate-950/90 px-2 text-sm backdrop-blur">
        <Link href="/" className="btn px-2 py-1 text-xs">
          ←
        </Link>
        <span className="whitespace-nowrap font-bold text-amber-400">💰{engine.gold}</span>
        <span className="whitespace-nowrap font-bold text-red-400">❤️{engine.lives}</span>
        <span className="whitespace-nowrap text-slate-300">
          🌊{engine.wave}/{engine.totalWaves}
        </span>
        <span className="hidden text-xs text-slate-500 md:inline">
          {engine.stage?.name} · {DIFFICULTY[engine.difficulty].label}
          {engine.job ? ` · ${engine.job.name}` : ""}
        </span>

        {/* 중앙: 웨이브 시작 / 조기 호출 버튼 (모바일은 HUD 아래 줄) */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          {waveButton}
        </div>

        <span className="ml-auto flex items-center gap-1.5">
          <button
            className="btn px-2 py-1 text-xs"
            title="효과음 (끄기 / 작게 / 크게)"
            onClick={() => {
              const snd = getSound();
              if (!snd) return;
              snd.unlock();
              setVolume(snd.cycleVolume());
            }}
          >
            {volume === null || volume === 0 ? "🔇" : volume < 1 ? "🔉" : "🔊"}
          </button>
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => {
              engine.speed = engine.speed === 1 ? 2 : 1;
              setUiTick((v) => v + 1);
            }}
          >
            ×{engine.speed}
          </button>
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => {
              engine.paused = !engine.paused;
              setUiTick((v) => v + 1);
            }}
          >
            {engine.paused ? "▶" : "⏸"}
          </button>
          <button
            className={`btn px-2 py-1 text-xs ${sheet === "log" ? "border-amber-500" : ""}`}
            onClick={() => setSheet(sheet === "log" ? "none" : "log")}
          >
            📜
          </button>
        </span>
      </div>

      {/* ===== 모바일: 웨이브 버튼 줄 (좁은 HUD에서 겹치지 않게) ===== */}
      <div className="relative z-30 flex shrink-0 justify-center border-b border-slate-800/60 bg-slate-950/90 py-1.5 md:hidden">
        {waveButton}
      </div>

      {/* ===== 본문: 좌 패널 | 캔버스 | 우 패널 ===== */}
      <div className="flex min-h-0 flex-1">
        {/* ---- 좌측 패널 (데스크톱) ---- */}
        <div className="hidden w-60 shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-800/60 bg-slate-950/80 p-2 lg:flex">
          {/* 스테이지 / 직업 / 스킬 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="text-xs font-bold text-slate-200">{engine.stage?.name}</div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              난이도: {DIFFICULTY[engine.difficulty].label}
            </div>

            {/* 가장 가까운 보스 정보 */}
            {bossInfo && (
              <div className="mt-2 rounded border border-red-900/60 bg-red-950/30 p-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-red-300">
                  <span>
                    {bossInfo.alive ? "⚔ 보스 전투 중!" : "👑 다음 보스"} · 웨이브{" "}
                    {bossInfo.wave}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <span className="text-base">{bossInfo.def.appearance.icon}</span>
                  {bossInfo.def.name}
                </div>
                {bossInfo.alive ? (
                  <div className="mt-1">
                    <div className="h-1.5 w-full rounded bg-slate-800">
                      <div
                        className="h-1.5 rounded bg-red-500"
                        style={{
                          width: `${Math.max(0, (bossInfo.alive.hp / bossInfo.maxHp) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      ❤️ {Math.max(0, Math.round(bossInfo.alive.hp)).toLocaleString()} /{" "}
                      {bossInfo.maxHp.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    예상 체력 ❤️ {bossInfo.maxHp.toLocaleString()}
                  </div>
                )}
                <div className="mt-0.5 flex gap-2 text-[10px] text-slate-400">
                  <span>🛡 {bossInfo.def.defense}</span>
                  <span>✨ {bossInfo.def.magicDefense}</span>
                  <span>👟 {bossInfo.def.moveSpeed}</span>
                </div>
                {bossInfo.def.description && (
                  <div className="mt-0.5 text-[9px] text-slate-500">
                    {bossInfo.def.description}
                  </div>
                )}
              </div>
            )}

            {/* 다음 웨이브 구성 미리보기 */}
            {nextWavePreview.length > 0 && (
              <div className="mt-2 rounded border border-slate-800 bg-slate-900 p-1.5">
                <div className="text-[10px] font-bold text-slate-400">
                  🌊 다음 웨이브 {engine.wave + 1} 구성
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {nextWavePreview.map(({ def, count }) => (
                    <span
                      key={def.id}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        def.isBoss ? "bg-red-500/20 text-red-300" : "bg-slate-800 text-slate-300"
                      }`}
                      title={def.traits?.map((t) => TRAIT_LABEL[t.type] ?? t.type).join(", ")}
                    >
                      {def.appearance.icon} {def.name} ×{count}
                      {def.traits && def.traits.length > 0 && (
                        <span className="ml-0.5 text-purple-300">
                          [{def.traits.map((t) => TRAIT_LABEL[t.type] ?? t.type).join("/")}]
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 웨이브 미션 */}
            {missionInfo && (
              <div
                className={`mt-2 rounded border p-1.5 ${
                  missionInfo.failed
                    ? "border-red-900/60 bg-red-950/20 opacity-80"
                    : "border-violet-800/60 bg-violet-950/20"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-violet-300">
                  <span>
                    🎯 {missionInfo.upcoming ? `웨이브 ${engine.wave + 1} 미션` : "진행 중 미션"}
                  </span>
                  <span className={missionInfo.failed ? "text-red-400" : "text-amber-400"}>
                    {missionInfo.failed ? "✖ 실패" : `+${missionInfo.def.rewardGold}G`}
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-bold text-slate-200">{missionInfo.def.name}</div>
                <div className="text-[10px] text-slate-400">
                  {missionInfo.def.description || describeMissionCondition(missionInfo.def.condition)}
                </div>
                {missionInfo.progress && (
                  <div className="mt-0.5 text-[10px] font-bold text-violet-200">{missionInfo.progress}</div>
                )}
              </div>
            )}

            {engine.job && (
              <>
                <div className="mt-2 border-t border-slate-800 pt-2 text-xs font-bold text-slate-200">
                  {engine.job.appearance?.icon} {engine.job.name}
                  {engine.job.synergyRegion && (
                    <span className="ml-1 text-[10px] font-normal text-amber-400/80">
                      [{engine.job.synergyRegion}] 시너지 +1
                    </span>
                  )}
                </div>
                {/* 패시브: 텍스트로 상시 표시 */}
                {passiveSkills.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {passiveSkills.map((s, i) => (
                      <div
                        key={i}
                        className="rounded bg-slate-900 px-1.5 py-1 text-[10px] text-slate-300"
                      >
                        <span className="font-bold text-sky-300">[패시브] {s.name}</span>{" "}
                        <span className="text-slate-400">
                          {s.description ??
                            `${PASSIVE_LABEL[s.type] ?? s.type} +${s.value}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* 액티브: hover 툴팁 버튼 + 난이도별 사용 횟수 */}
                {activeSkills.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>액티브 스킬</span>
                      <span
                        className={
                          engine.jobSkillUsesLeft <= 0
                            ? "font-bold text-red-400"
                            : "font-bold text-amber-400"
                        }
                      >
                        남은 사용 {engine.jobSkillUsesLeft}/
                        {DIFFICULTY[engine.difficulty].jobSkillUses}회
                      </span>
                    </div>
                    {activeSkills.map(({ index }) => jobSkillButton(index, false))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 시너지 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="mb-1.5 text-xs font-bold text-slate-200">🔗 시너지</div>
            {synergyList(true)}
          </div>

          {/* hover / 선택 정보 */}
          <div className="min-h-36 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-xs">
            <div className="mb-1.5 text-xs font-bold text-slate-200">ℹ️ 정보</div>
            {hoverEnemy ? (
              enemyInfoBody(hoverEnemy)
            ) : hoverTower && hoverTower.uid !== selectedUid ? (
              towerInfoBody(hoverTower, engine.towerDefs.get(hoverTower.defId)!)
            ) : selectedUnit && selectedDef ? (
              <>
                {towerInfoBody(selectedUnit, selectedDef)}
                {fusionCandidates.size > 0 && !fusionTargetUid && (
                  <div className="mt-1.5 text-[10px] text-amber-400">
                    점선 표시된 같은 등급을 클릭하면 합성 대상 지정
                  </div>
                )}
                {unitActionButtons}
              </>
            ) : (
              <p className="text-[11px] text-slate-500">
                맵의 타워/적에 마우스를 올리거나 유닛을 선택하면 정보가 표시됩니다.
              </p>
            )}
          </div>
        </div>

        {/* ---- 캔버스 영역 ---- */}
        <div ref={areaRef} className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={Math.round(engine.map.cols * tileSize * dpr)}
              height={Math.round(engine.map.rows * tileSize * dpr)}
              style={{
                width: engine.map.cols * tileSize,
                height: engine.map.rows * tileSize,
                touchAction: "none",
              }}
              className={aimSkillIndex !== null ? "cursor-crosshair" : "cursor-pointer"}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerCancel}
              onContextMenu={handleContextMenu}
            />
          </div>

          {/* 모바일: 좌측 시너지 칩 */}
          <div className="absolute left-1.5 top-1.5 z-20 flex max-h-[60%] flex-col gap-1 overflow-y-auto lg:hidden">
            {engine.activeSynergies.map((syn) => (
              <button
                key={syn.synergyId}
                onClick={() => setSheet(sheet === "synergy" ? "none" : "synergy")}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur ${
                  syn.activeTierIndex >= 0
                    ? "border-slate-500 bg-slate-900/85"
                    : "border-slate-800 bg-slate-950/70 opacity-70"
                }`}
                style={{ color: syn.color }}
              >
                {syn.region}
                <span className="text-slate-300">{syn.count}</span>
              </button>
            ))}
          </div>

          {/* 모바일: 우상단 미션 */}
          {missionInfo && (
            <div
              className={`absolute right-1.5 top-10 z-20 max-w-[45%] rounded-lg border px-2 py-1 text-[10px] backdrop-blur lg:hidden ${
                missionInfo.failed
                  ? "border-red-900/70 bg-red-950/60 text-red-300"
                  : "border-violet-700/70 bg-slate-950/80 text-violet-200"
              }`}
            >
              <div className="truncate font-bold">
                🎯 {missionInfo.def.name}{" "}
                <span className={missionInfo.failed ? "" : "text-amber-400"}>
                  {missionInfo.failed ? "✖ 실패" : `+${missionInfo.def.rewardGold}G`}
                </span>
              </div>
              <div className="truncate text-slate-400">
                {missionInfo.progress || describeMissionCondition(missionInfo.def.condition)}
              </div>
            </div>
          )}

          {/* 모바일: 우하단 원형 직업 스킬 */}
          {activeSkills.length > 0 && (
            <div className="absolute bottom-2 right-2 z-20 flex flex-col gap-2 lg:hidden">
              {activeSkills.map(({ index }) => jobSkillButton(index, true))}
            </div>
          )}

          {/* 조준 안내 */}
          {aimSkillIndex !== null && (
            <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-orange-500/90 px-3 py-1 text-xs font-bold text-slate-950">
              🎯 맵을 클릭해 시전 (스킬 버튼으로 취소)
            </div>
          )}

          {/* 최근 로그 토스트 */}
          {lastLog && aimSkillIndex === null && (
            <div
              className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950/70 px-3 py-1 text-[11px] backdrop-blur"
              style={{ color: lastLog.color ?? "#94a3b8" }}
            >
              {lastLog.text}
            </div>
          )}

          {/* 모바일: 선택 타워 정보 플로팅 카드 */}
          {selectedUnit && selectedDef && (
            <div className="absolute bottom-2 left-1/2 z-20 w-[min(94%,480px)] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/95 p-2.5 text-xs shadow-xl backdrop-blur lg:hidden">
              <div className="flex items-start">
                <div className="min-w-0 flex-1">
                  {towerInfoBody(selectedUnit, selectedDef)}
                </div>
                <button
                  className="ml-2 text-slate-500"
                  onClick={() => {
                    setSelectedUid(null);
                    setFusionTargetUid(null);
                  }}
                >
                  ✕
                </button>
              </div>
              {fusionCandidates.size > 0 && !fusionTargetUid && (
                <div className="mt-1 text-[10px] text-amber-400">
                  점선 표시된 같은 등급을 탭하면 합성 대상 지정
                </div>
              )}
              {unitActionButtons}
            </div>
          )}

          {/* 승리/패배 오버레이 */}
          {(engine.phase === "victory" || engine.phase === "defeat") && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur">
              <div className="text-4xl font-extrabold">
                {engine.phase === "victory" ? "🎉 승리!" : "💀 게임 오버"}
              </div>
              <div className="text-sm text-slate-400">
                웨이브 {engine.wave}/{engine.totalWaves} · {engine.stage?.name} · 시드{" "}
                {engine.seed}
              </div>
              {towerStats.length > 0 && (
                <div className="w-[min(92%,420px)] rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs">
                  <div className="mb-1.5 font-bold text-slate-200">🏆 전투 기여도</div>
                  {towerStats.slice(0, 6).map((s, i) => {
                    const total = towerStats.reduce((sum, x) => sum + x.damage, 0) || 1;
                    return (
                      <div key={s.unit.uid} className="mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={i === 0 ? "font-bold text-amber-400" : "text-slate-400"}>
                            {i === 0 ? "MVP" : `#${i + 1}`}
                          </span>
                          <span
                            className="rounded px-1 text-[9px] font-bold text-slate-950"
                            style={{ backgroundColor: GRADE_COLOR[s.def.grade] }}
                          >
                            {GRADE_LABEL[s.def.grade]}
                          </span>
                          <span>
                            {s.def.appearance.icon} {s.def.name}
                          </span>
                          <span className="ml-auto text-slate-300">
                            {s.damage.toLocaleString()} ({Math.round((s.damage / total) * 100)}%) · ☠{" "}
                            {s.kills}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 w-full rounded bg-slate-800">
                          <div
                            className="h-1 rounded"
                            style={{
                              width: `${(s.damage / total) * 100}%`,
                              backgroundColor: GRADE_COLOR[s.def.grade],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/" className="btn btn-primary px-8 py-3 text-lg font-bold">
                돌아가기
              </Link>
            </div>
          )}
        </div>

        {/* ---- 우측 패널 (데스크톱) ---- */}
        <div className="hidden w-64 shrink-0 flex-col gap-2 overflow-y-auto border-l border-slate-800/60 bg-slate-950/80 p-2 lg:flex">
          {/* 자원 */}
          <div className="flex items-center justify-around rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="text-center">
              <div className="text-lg font-extrabold text-amber-400">💰 {engine.gold}</div>
              <div className="text-[10px] text-slate-500">골드</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold text-red-400">❤️ {engine.lives}</div>
              <div className="text-[10px] text-slate-500">목숨</div>
            </div>
          </div>

          {/* 바로 뽑기 (최근 뽑기 반복) / 상점 열기 (popover) */}
          <div className="relative grid grid-cols-2 gap-2">
            <button
              className="rounded-lg border-2 border-amber-500 bg-amber-500/15 py-3 text-center text-sm font-bold text-amber-300 transition-transform active:scale-95 disabled:opacity-40"
              disabled={!quickGachaReady}
              onClick={() =>
                quickGachaDef && doGacha(quickGachaDef.id, quickGachaRegion)
              }
              title={
                quickGachaDef
                  ? `${quickGachaDef.name}${quickGachaRegion ? ` [${quickGachaRegion}]` : ""} 1회 (${gachaCost(quickGachaDef, engine.job)}G)`
                  : ""
              }
            >
              🎲 바로 뽑기
              {quickGachaDef && (
                <span className="block truncate px-1 text-[10px] font-normal">
                  {quickGachaDef.name}
                  {quickGachaRegion ? ` [${quickGachaRegion}]` : ""} ·{" "}
                  {gachaCost(quickGachaDef, engine.job)}G
                </span>
              )}
            </button>
            <button
              ref={shopBtnRef}
              className={`rounded-lg border-2 py-3 text-center text-sm font-bold transition-transform active:scale-95 ${
                shopOpen
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-slate-600 bg-slate-800/60 text-slate-200"
              }`}
              onClick={() => setShopOpen((v) => !v)}
            >
              🏪 상점 {shopOpen ? "닫기" : "열기"}
              <span className="block text-[10px] font-normal text-slate-400">
                뽑기 {engine.gachaDefs.length}종
              </span>
            </button>

            {/* 상점 popover (버튼에 붙어서 표시, fixed로 스크롤/오버플로우 클리핑 회피) */}
            {shopOpen && shopBtnRef.current && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShopOpen(false)} />
                <div
                  className="fixed z-50 w-72 rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-2xl"
                  style={(() => {
                    const rect = shopBtnRef.current.getBoundingClientRect();
                    return {
                      top: Math.min(rect.bottom + 6, window.innerHeight - 420),
                      right: window.innerWidth - rect.right,
                    };
                  })()}
                >
                  <div className="mb-2 flex items-center">
                    <h3 className="text-sm font-bold text-slate-200">🏪 상점 — 캐릭터 뽑기</h3>
                    <button
                      className="ml-auto px-1 text-slate-500"
                      onClick={() => setShopOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                  {gachaButtons}
                </div>
              </>
            )}
          </div>

          {/* 보유 캐릭터 (대기석) */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-2">
            <div className="mb-1.5 text-xs font-bold text-slate-200">
              내 보유 캐릭터 ({engine.bench.length}/9)
            </div>
            <div className="flex flex-wrap content-start gap-1.5 overflow-y-auto">
              {benchCards}
              {engine.bench.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  뽑기로 캐릭터를 획득하세요. 카드를 맵으로 드래그하거나, 클릭 후 초록
                  타일을 클릭해 배치합니다.
                </p>
              )}
            </div>
            {fusionCandidates.size > 0 && !fusionTargetUid && (
              <p className="mt-1 text-[10px] text-amber-400">
                점선 카드 클릭 → 합성 대상 지정
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ===== 모바일: 하단 대기석 바 ===== */}
      <div className="z-30 shrink-0 border-t border-slate-800/60 bg-slate-950/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-1.5">
            {benchCards}
            {engine.bench.length === 0 && (
              <p className="self-center whitespace-nowrap px-1 text-[11px] text-slate-500">
                뽑기로 캐릭터 획득 → 카드 탭 → 초록 타일 탭으로 배치
              </p>
            )}
          </div>
          <button
            className="mb-1.5 flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-amber-500 bg-amber-500/15 text-amber-300 transition-transform active:scale-95"
            onClick={() => setSheet(sheet === "gacha" ? "none" : "gacha")}
          >
            <span className="text-xl">🎲</span>
            <span className="text-[10px] font-bold">뽑기</span>
          </button>
        </div>
      </div>

      {/* ===== 시트: 상점(뽑기) ===== */}
      {sheet === "gacha" && (
        <Sheet title="🏪 상점 — 캐릭터 뽑기" onClose={() => setSheet("none")}>
          {gachaButtons}
        </Sheet>
      )}

      {/* ===== 시트: 시너지 (모바일) ===== */}
      {sheet === "synergy" && (
        <Sheet title="🔗 지역 시너지 (효과는 아군 전체 적용)" onClose={() => setSheet("none")}>
          <div className="space-y-2">
            {engine.activeSynergies.map((syn) => (
              <div
                key={syn.synergyId}
                className={`rounded-lg border p-2 text-xs ${
                  syn.activeTierIndex >= 0
                    ? "border-slate-600 bg-slate-800/70"
                    : "border-slate-800 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: syn.color }}>
                    {syn.region} · {syn.name}
                  </span>
                  <span className="text-slate-300">
                    {syn.tiers.map((t, i) => (
                      <span
                        key={t.count}
                        className={i === syn.activeTierIndex ? "font-bold text-amber-400" : ""}
                      >
                        {i > 0 && " / "}
                        {t.count}
                      </span>
                    ))}
                    <span className="ml-1 text-slate-500">({syn.count})</span>
                  </span>
                </div>
                {syn.description && (
                  <p className="mt-1 text-[10px] text-slate-400">{syn.description}</p>
                )}
                <div className="mt-1.5 space-y-1">
                  {syn.tiers.map((tier, i) => (
                    <div
                      key={tier.count}
                      className={`rounded px-1.5 py-1 text-[10px] ${
                        i === syn.activeTierIndex
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      <b>{tier.count}명</b>:{" "}
                      {tier.effects
                        .map((e) => `${SYNERGY_EFFECT_LABEL[e.type] ?? e.type} +${e.value}`)
                        .join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {/* ===== 합성 popover (합성 대상을 지정한 지점 근처에 표시) ===== */}
      {fusionTargetUid && fusionTargetDef && selectedDef && fusionPopoverPos && (
        <div
          className="fixed z-[65] -translate-x-1/2 rounded-xl border border-amber-600 bg-slate-950/95 p-2 text-xs shadow-2xl backdrop-blur"
          style={{
            left: Math.max(120, Math.min(fusionPopoverPos.x, window.innerWidth - 120)),
            top: Math.max(52, fusionPopoverPos.y - 92),
          }}
        >
          <div className="whitespace-nowrap text-center text-slate-300">
            <b>{selectedDef.name}</b> + <b>{fusionTargetDef.name}</b>
          </div>
          <div className="mt-0.5 whitespace-nowrap text-center text-[10px] text-amber-400">
            상위 등급 획득 (1% 확률 2단계 점프!)
          </div>
          <div className="mt-1.5 flex justify-center gap-1.5">
            <button className="btn btn-primary px-4 py-1 font-bold" onClick={doFuse}>
              ⚗️ 합성
            </button>
            <button className="btn px-3 py-1" onClick={clearFusion}>
              취소
            </button>
          </div>
        </div>
      )}

      {/* ===== 유닛 빠른 메뉴 (터치 롱프레스 / 마우스 우클릭) ===== */}
      {unitMenu &&
        (() => {
          const unit = engine.findUnit(unitMenu.uid);
          const def = unit ? engine.towerDefs.get(unit.defId) : undefined;
          if (!unit || !def) return null;
          const placed = !!unit.tile;
          const candidates = engine.fusionCandidates(unit.uid).length;
          const close = () => setUnitMenu(null);
          const act = (ok: boolean) => {
            if (ok) {
              setSelectedUid(null);
              clearFusion();
            }
            close();
          };
          return (
            <>
              <div
                className="fixed inset-0 z-[66]"
                onPointerDown={() => (menuBackdropDownRef.current = true)}
                onClick={() => {
                  if (menuBackdropDownRef.current) close();
                  menuBackdropDownRef.current = false;
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  close();
                }}
              />
              <div
                className="fixed z-[67] w-56 rounded-xl border border-slate-600 bg-slate-950/95 p-2 text-xs shadow-2xl backdrop-blur"
                style={{
                  left: Math.max(8, Math.min(unitMenu.x - 112, window.innerWidth - 232)),
                  top: Math.max(56, Math.min(unitMenu.y + 12, window.innerHeight - 290)),
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: GRADE_COLOR[def.grade] }}
                  >
                    {GRADE_LABEL[def.grade]}
                  </span>
                  <span className="truncate font-bold">
                    {def.appearance.icon} {def.name}
                  </span>
                  <button className="ml-auto px-1 text-slate-500" onClick={close}>
                    ✕
                  </button>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  [{def.regions.join(", ")}] · {placed ? "배치됨" : "대기석"}
                </div>

                {placed && (
                  <>
                    <div className="mt-2 text-[10px] font-bold text-slate-400">🎯 타겟팅</div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {(Object.keys(TARGET_MODE_LABEL) as TargetMode[]).map((m) => (
                        <button
                          key={m}
                          className={`btn px-1 py-1.5 text-[11px] ${
                            unit.targetMode === m ? "border-amber-500 bg-amber-500/20 text-amber-300" : ""
                          }`}
                          onClick={() => engine.setTargetMode(unit.uid, m)}
                        >
                          {TARGET_MODE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-2 grid grid-cols-2 gap-1">
                  {placed && (
                    <button
                      className="btn py-2 text-[11px]"
                      disabled={engine.bench.length >= BENCH_SIZE}
                      onClick={() => act(engine.unplaceTower(unit.uid))}
                    >
                      ↩ 회수
                    </button>
                  )}
                  <button
                    className={`btn btn-danger py-2 text-[11px] ${placed ? "" : "col-span-2"}`}
                    onClick={() => act(engine.sellTower(unit.uid))}
                  >
                    💰 판매 +{sellRefund(def.grade)}G
                  </button>
                  {candidates > 0 && (
                    <button
                      className="btn col-span-2 py-2 text-[11px] text-amber-300"
                      onClick={close}
                    >
                      ⚗️ 합성 대상 고르기 ({candidates}) — 점선 유닛을 탭
                    </button>
                  )}
                </div>
              </div>
            </>
          );
        })()}

      {/* ===== 대기석 드래그 고스트 ===== */}
      {benchGhost && (
        <div
          className="pointer-events-none fixed z-[65] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-2 bg-slate-900/90 text-2xl shadow-xl"
          style={{
            left: benchGhost.x,
            top: benchGhost.y,
            borderColor:
              GRADE_COLOR[engine.towerDefs.get(benchGhost.defId)?.grade ?? "common"],
          }}
        >
          {engine.towerDefs.get(benchGhost.defId)?.appearance.icon}
        </div>
      )}

      {/* ===== 시트: 로그 ===== */}
      {sheet === "log" && (
        <Sheet title="📜 전투 로그" onClose={() => setSheet("none")}>
          <div className="flex flex-col-reverse gap-0.5 text-[11px]">
            {[...engine.logs].reverse().map((l, i) => (
              <div key={i} style={{ color: l.color ?? "#94a3b8" }}>
                {l.text}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/**
 * hover 툴팁 — position: fixed로 렌더링해서
 * 스크롤 컨테이너의 overflow 클리핑이나 캔버스 영역에 가려지는 문제를 회피
 */
function HoverTip({
  tip,
  children,
}: {
  tip: React.ReactNode;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  return (
    <div
      ref={anchorRef}
      onMouseEnter={() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({
          left: rect.right + 8,
          // 화면 아래로 넘치지 않게 클램프
          top: Math.max(8, Math.min(rect.top, window.innerHeight - 320)),
        });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <div
          className="pointer-events-none fixed z-[70] w-60 rounded-md border border-slate-600 bg-slate-950 p-2 text-[11px] shadow-2xl"
          style={pos}
        >
          {tip}
        </div>
      )}
    </div>
  );
}

/** 바텀시트 (모바일) / 중앙 모달처럼 동작 (데스크톱) */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-950 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl lg:w-[420px] lg:rounded-2xl lg:border">
        <div className="mb-2 flex items-center">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-700 lg:hidden" />
          <h3 className="mt-1 text-sm font-bold text-slate-200">{title}</h3>
          <button className="ml-auto mt-1 px-2 text-slate-500" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
