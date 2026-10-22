"use client";

import GradeSlot from "@/components/ui/GradeSlot";
import Icon from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Overlay";
import {
  BENCH_SIZE,
  DIFFICULTY,
  FUSION_JACKPOT_PCT,
  GRADE_COLOR,
  GRADE_LABEL,
  GRADE_ORDER,
  TARGET_MODE_LABEL,
} from "@/game/constants";
import type { GameEngine } from "@/game/engine";
import { jobPassiveValue, sellRefund } from "@/game/gacha";
import type { TargetMode, TowerDef } from "@/game/types";

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 승리 / 패배 결과 화면 */
export function ResultOverlay({
  engine,
  onRetry,
  onLobby,
}: {
  engine: GameEngine;
  onRetry: () => void;
  onLobby: () => void;
}) {
  const win = engine.phase === "victory";
  const stats = engine.towerStats();
  const total = stats.reduce((s, x) => s + x.damage, 0) || 1;
  const step = (i: number) => ({ animationDelay: `${180 + i * 90}ms` });

  return (
    <div className="fixed inset-0 z-[85] flex animate-fade-in items-center justify-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-sm">
      {win && (
        <div
          className="pointer-events-none absolute left-1/2 top-[30%] h-[900px] w-[900px] animate-rays opacity-30"
          style={{
            background: "repeating-conic-gradient(from 0deg, rgba(243,220,156,0.35) 0deg 5deg, transparent 5deg 15deg)",
            maskImage: "radial-gradient(closest-side, black, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, black, transparent)",
          }}
        />
      )}
      <div className="relative w-full max-w-md text-center">
        <div className="animate-fade-rise font-display text-[11px] font-bold uppercase tracking-[0.35em] text-parchment-500" style={step(0)}>
          {engine.stage?.name} · {DIFFICULTY[engine.difficulty].label}
        </div>
        <h2
          className={`mt-1 animate-fade-rise font-display text-6xl font-black sm:text-7xl ${
            win ? "text-gold-shimmer animate-shimmer" : "text-blood-grad"
          }`}
          style={{ ...step(1), filter: `drop-shadow(0 0 24px ${win ? "rgba(230,194,116,0.45)" : "rgba(229,72,77,0.45)"})` }}
        >
          {win ? "VICTORY" : "DEFEAT"}
        </h2>
        <p className="mt-1 animate-fade-rise font-serif text-base font-bold text-parchment-100" style={step(2)}>
          {win ? "아크라시아를 지켜냈습니다" : "방어선이 무너졌습니다"}
        </p>

        <div className="mt-5 grid animate-fade-rise grid-cols-4 gap-2" style={step(3)}>
          {[
            { icon: "flag" as const, label: "웨이브", value: `${engine.wave}/${engine.totalWaves}` },
            { icon: "heart" as const, label: "목숨", value: Math.max(0, engine.lives) },
            { icon: "coin" as const, label: "골드", value: engine.gold },
            { icon: "hourglass" as const, label: "시간", value: fmtTime(engine.time) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-ink-900/70 px-1 py-2">
              <Icon name={s.icon} className="mx-auto text-base text-gold-400" />
              <div className="mt-1 font-display text-lg font-bold text-parchment-50">{s.value}</div>
              <div className="text-[10px] text-parchment-500">{s.label}</div>
            </div>
          ))}
        </div>

        {stats.length > 0 && (
          <div className="frame mt-4 animate-fade-rise p-3 text-left" style={step(4)}>
            <div className="frame-title">Battle Record</div>
            <div className="mt-3 space-y-2">
              {stats.slice(0, 5).map((s, i) => {
                const share = s.damage / total;
                return (
                  <div key={s.unit.uid} className="flex items-center gap-2.5">
                    <span
                      className={`w-8 shrink-0 text-center font-display text-xs font-bold ${
                        i === 0 ? "text-gold-300" : "text-parchment-500"
                      }`}
                    >
                      {i === 0 ? "MVP" : `#${i + 1}`}
                    </span>
                    <GradeSlot grade={s.def.grade} appearance={s.def.appearance} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-bold text-parchment-100">{s.def.name}</span>
                        <span className="shrink-0 text-parchment-400">
                          {Math.round(share * 100)}% · 처치 {s.kills}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-950">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share * 100}%`, backgroundColor: GRADE_COLOR[s.def.grade] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex animate-fade-rise gap-2" style={step(5)}>
          <button className="btn-gold sheen h-12 flex-1 text-base" onClick={onRetry}>
            <Icon name="refresh" />
            다시 도전
          </button>
          <button className="btn-ghost h-12 flex-1 text-base" onClick={onLobby}>
            <Icon name="home" />
            로비로
          </button>
        </div>
      </div>
    </div>
  );
}

/** 일시정지 메뉴 */
export function PauseMenu({
  open,
  volume,
  speed,
  onResume,
  onCycleVolume,
  onToggleSpeed,
  onOpenLog,
  onLobby,
}: {
  open: boolean;
  volume: number | null;
  speed: number;
  onResume: () => void;
  onCycleVolume: () => void;
  onToggleSpeed: () => void;
  onOpenLog: () => void;
  onLobby: () => void;
}) {
  const volIcon = volume === null || volume === 0 ? "volumeOff" : volume < 1 ? "volumeLow" : "volumeHigh";
  const volLabel = volume === null || volume === 0 ? "끔" : volume < 1 ? "작게" : "크게";
  return (
    <Modal open={open} onClose={onResume} kicker="Paused" title="일시정지" width={360}>
      <div className="space-y-2">
        <button className="btn-gold h-12 w-full text-base" onClick={onResume}>
          <Icon name="play" /> 계속하기
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost h-11 text-sm" onClick={onCycleVolume}>
            <Icon name={volIcon} className="text-gold-400" /> 효과음 {volLabel}
          </button>
          <button className="btn-ghost h-11 text-sm" onClick={onToggleSpeed}>
            <Icon name="fast" className="text-gold-400" /> 속도 ×{speed}
          </button>
        </div>
        <button className="btn-ghost h-11 w-full text-sm" onClick={onOpenLog}>
          <Icon name="log" className="text-gold-400" /> 전투 기록
        </button>
        <button className="btn-ghost h-11 w-full text-sm text-parchment-300" onClick={onLobby}>
          <Icon name="exit" /> 저장하고 로비로
        </button>
        <p className="pt-1 text-center text-[11px] text-parchment-500">
          Esc로 열고 닫기 · 선택한 유닛: W 회수 / F 판매
        </p>
      </div>
    </Modal>
  );
}

/** 유닛 빠른 메뉴 (터치 롱프레스 / 우클릭) */
export function UnitQuickMenu({
  engine,
  uid,
  x,
  y,
  onClose,
  onDone,
}: {
  engine: GameEngine;
  uid: string;
  x: number;
  y: number;
  onClose: () => void;
  /** 회수/판매처럼 유닛 선택이 풀리는 행동 후 */
  onDone: () => void;
}) {
  const unit = engine.findUnit(uid);
  const def = unit ? engine.towerDefs.get(unit.defId) : undefined;
  if (!unit || !def) return null;
  const placed = !!unit.tile;
  const candidates = engine.fusionCandidates(unit.uid).length;
  const act = (ok: boolean) => {
    if (ok) onDone();
    onClose();
  };
  const W = 232;
  return (
    <div
      className="frame fixed z-[67] animate-pop-in p-2.5 text-xs"
      style={{
        width: W,
        left: Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8)),
        top: Math.max(56, Math.min(y + 12, window.innerHeight - 300)),
        transformOrigin: "top center",
      }}
    >
      <div className="flex items-center gap-2">
        <GradeSlot grade={def.grade} appearance={def.appearance} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold" style={{ color: GRADE_COLOR[def.grade] }}>
            {GRADE_LABEL[def.grade]} · {placed ? "배치됨" : "대기석"}
          </div>
          <div className="truncate font-serif text-sm font-bold text-parchment-50">{def.name}</div>
        </div>
        <button className="btn-ghost h-7 w-7 rounded-lg text-parchment-400" onClick={onClose} aria-label="닫기">
          <Icon name="close" />
        </button>
      </div>

      {placed && (
        <>
          <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-parchment-500">
            <Icon name="target" /> 공격 대상
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(Object.keys(TARGET_MODE_LABEL) as TargetMode[]).map((m) => (
              <button
                key={m}
                className={`rounded-lg border px-1 py-1.5 text-[11px] font-bold transition duration-150 ${
                  unit.targetMode === m
                    ? "border-gold-400/70 bg-gold-500/15 text-gold-200"
                    : "border-white/10 text-parchment-300 hover:border-white/25"
                }`}
                onClick={() => engine.setTargetMode(unit.uid, m)}
              >
                {TARGET_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-1">
        {placed && (
          <button
            className="btn-ghost h-9 text-[11px]"
            disabled={engine.bench.length >= BENCH_SIZE}
            onClick={() => act(engine.unplaceTower(unit.uid))}
          >
            <Icon name="recall" /> 회수
          </button>
        )}
        <button
          className={`btn-ghost h-9 border-blood-500/30 text-[11px] text-blood-400 hover:border-blood-400/60 hover:text-blood-400 ${
            placed ? "" : "col-span-2"
          }`}
          onClick={() => act(engine.sellTower(unit.uid))}
        >
          <Icon name="coin" /> 판매 +{sellRefund(def.grade)}
        </button>
        {candidates > 0 && (
          <button className="btn-ghost col-span-2 h-9 text-[11px] text-gold-300" onClick={onClose}>
            <Icon name="sparkles" /> 합성할 유닛 고르기 ({candidates})
          </button>
        )}
      </div>
    </div>
  );
}

/** 합성 확인 팝오버 */
export function FusionPopover({
  engine,
  a,
  b,
  x,
  y,
  onFuse,
  onCancel,
}: {
  engine: GameEngine;
  a: TowerDef;
  b: TowerDef;
  x: number;
  y: number;
  onFuse: () => void;
  onCancel: () => void;
}) {
  const next = GRADE_ORDER[Math.min(GRADE_ORDER.indexOf(a.grade) + 1, GRADE_ORDER.length - 1)];
  const jackpot = FUSION_JACKPOT_PCT + jobPassiveValue(engine.job, "fusion_jackpot_pct");
  return (
    <div
      className="fixed z-[65]"
      style={{
        left: Math.max(130, Math.min(x, window.innerWidth - 130)),
        top: Math.max(60, y - 150),
        transform: "translateX(-50%)",
      }}
    >
      <div className="frame animate-pop-in p-3 text-xs" style={{ transformOrigin: "bottom center" }}>
        <div className="flex items-center justify-center gap-2">
          <GradeSlot grade={a.grade} appearance={a.appearance} size={40} />
          <Icon name="plus" className="text-parchment-500" />
          <GradeSlot grade={b.grade} appearance={b.appearance} size={40} />
          <Icon name="chevronRight" className="text-gold-400" />
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-black"
            style={{ borderColor: GRADE_COLOR[next], color: GRADE_COLOR[next], boxShadow: `0 0 14px -2px ${GRADE_COLOR[next]}` }}
          >
            ?
          </div>
        </div>
        <div className="mt-2 text-center">
          <span className="font-bold" style={{ color: GRADE_COLOR[next] }}>
            {GRADE_LABEL[next]}
          </span>
          <span className="text-parchment-400"> 등급 캐릭터 획득</span>
          <div className="text-[10px] text-parchment-500">{jackpot}% 확률로 2단계 상승</div>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <button className="btn-gold h-9 flex-1 text-sm" onClick={onFuse}>
            <Icon name="sparkles" /> 합성
          </button>
          <button className="btn-ghost h-9 px-3 text-sm" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
