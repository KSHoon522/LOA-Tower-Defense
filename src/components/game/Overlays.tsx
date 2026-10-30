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
  // 승리 별점: 목숨을 하나도 잃지 않으면 3개, 절반 이상 남으면 2개, 그 외 1개
  const startLives = DIFFICULTY[engine.difficulty].lives + jobPassiveValue(engine.job, "extra_lives");
  const kept = startLives > 0 ? Math.max(0, engine.lives) / startLives : 0;
  const stars = !win ? 0 : kept >= 1 ? 3 : kept >= 0.5 ? 2 : 1;

  return (
    <div className="fixed inset-0 z-[85] flex animate-fade-in items-center justify-center overflow-y-auto bg-[#0a0e33]/80 p-4">
      {win && (
        <div
          className="pointer-events-none absolute left-1/2 top-[28%] h-[900px] w-[900px] animate-rays opacity-40"
          style={{
            background: "repeating-conic-gradient(from 0deg, #fff4b8 0deg 8deg, transparent 8deg 20deg)",
            maskImage: "radial-gradient(closest-side, black 20%, transparent)",
            WebkitMaskImage: "radial-gradient(closest-side, black 20%, transparent)",
          }}
        />
      )}
      <div className="relative w-full max-w-md text-center">
        <div className="mx-auto w-fit animate-pop-in rounded-full border-[3px] border-line bg-ink-900 px-3 py-0.5 text-sm text-parchment-100 shadow-[0_3px_0_#1b1438]" style={step(0)}>
          {engine.stage?.name} · {DIFFICULTY[engine.difficulty].label}
        </div>
        <div className="animate-pop-in" style={step(1)}>
          <h2
            className={`mt-2 -rotate-3 font-display text-7xl leading-none sm:text-8xl ${win ? "text-gold-grad" : "text-blood-grad"}`}
          >
            {win ? "승리!" : "패배…"}
          </h2>
        </div>
        {win && (
          <div className="mt-3 flex items-end justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`animate-pop-in ${i === 1 ? "-translate-y-2 text-6xl" : "text-5xl"} ${
                  i < stars ? "text-gold-400" : "text-ink-700"
                }`}
                style={{ animationDelay: `${450 + i * 160}ms` }}
              >
                <Icon
                  name="star"
                  style={{
                    filter:
                      "drop-shadow(2px 0 0 #1b1438) drop-shadow(-2px 0 0 #1b1438) drop-shadow(0 -2px 0 #1b1438) drop-shadow(0 3px 0 #1b1438)",
                  }}
                />
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 animate-fade-rise text-lg text-parchment-50 text-toon-sm" style={step(2)}>
          {win ? "아크라시아를 지켜냈어요!" : "방어선이 무너졌어요"}
        </p>

        <div className="mt-4 grid animate-fade-rise grid-cols-4 gap-2" style={step(3)}>
          {[
            { icon: "flag" as const, label: "웨이브", value: `${engine.wave}/${engine.totalWaves}`, color: "#4fdcff" },
            { icon: "heart" as const, label: "목숨", value: Math.max(0, engine.lives), color: "#ff6b72" },
            { icon: "coin" as const, label: "골드", value: engine.gold, color: "#ffd23a" },
            { icon: "hourglass" as const, label: "시간", value: fmtTime(engine.time), color: "#b968ff" },
          ].map((s) => (
            <div key={s.label} className="frame rounded-2xl px-1 pb-2 pt-1.5">
              <span
                className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 border-line text-parchment-50"
                style={{ backgroundColor: s.color }}
              >
                <Icon name={s.icon} className="text-sm drop-shadow-[0_1px_0_#1b1438]" />
              </span>
              <div className="mt-1 font-display text-xl text-parchment-50 text-toon-sm">{s.value}</div>
              <div className="text-[11px] text-parchment-300">{s.label}</div>
            </div>
          ))}
        </div>

        {stats.length > 0 && (
          <div className="frame mt-4 animate-fade-rise p-3 text-left" style={step(4)}>
            <div className="frame-title">전투 기록</div>
            <div className="mt-3 space-y-2">
              {stats.slice(0, 5).map((s, i) => {
                const share = s.damage / total;
                return (
                  <div key={s.unit.uid} className="flex items-center gap-2.5">
                    <span
                      className={`w-9 shrink-0 text-center font-display text-sm text-toon-sm ${
                        i === 0 ? "-rotate-6 text-gold-300" : "text-parchment-300"
                      }`}
                    >
                      {i === 0 ? "MVP" : `#${i + 1}`}
                    </span>
                    <GradeSlot grade={s.def.grade} appearance={s.def.appearance} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate text-sm text-parchment-50">{s.def.name}</span>
                        <span className="shrink-0 text-parchment-300">
                          {Math.round(share * 100)}% · 처치 {s.kills}
                        </span>
                      </div>
                      <div className="gauge mt-1 h-3">
                        <div
                          className="gauge-fill"
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
          <button className="btn-green sheen h-14 flex-1 text-xl" onClick={onRetry}>
            <Icon name="refresh" />
            다시 도전
          </button>
          <button className="btn-ghost h-14 flex-1 text-xl" onClick={onLobby}>
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
    <Modal open={open} onClose={onResume} kicker="Pause" title="일시정지" width={360}>
      <div className="space-y-2">
        <button className="btn-green h-14 w-full text-xl" onClick={onResume}>
          <Icon name="play" /> 계속하기
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost h-12 text-base" onClick={onCycleVolume}>
            <Icon name={volIcon} className="text-gold-300" /> 효과음 {volLabel}
          </button>
          <button className="btn-ghost h-12 text-base" onClick={onToggleSpeed}>
            <Icon name="fast" className="text-gold-300" /> 속도 ×{speed}
          </button>
        </div>
        <button className="btn-ghost h-12 w-full text-base" onClick={onOpenLog}>
          <Icon name="log" className="text-gold-300" /> 전투 기록
        </button>
        <button className="btn-red h-12 w-full text-base" onClick={onLobby}>
          <Icon name="exit" /> 저장하고 로비로
        </button>
        <p className="pt-1 text-center text-xs text-parchment-300">
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
      className="frame fixed z-[67] animate-pop-in rounded-2xl p-2.5 text-xs"
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
          <div className="font-display text-[11px] text-toon-sm" style={{ color: GRADE_COLOR[def.grade] }}>
            {GRADE_LABEL[def.grade]} · {placed ? "배치됨" : "대기석"}
          </div>
          <div className="truncate font-display text-base leading-tight text-parchment-50 text-toon-sm">{def.name}</div>
        </div>
        <button className="btn-red h-8 w-8 rounded-full" onClick={onClose} aria-label="닫기">
          <Icon name="close" />
        </button>
      </div>

      {placed && (
        <>
          <div className="mt-2.5 flex items-center gap-1 text-[11px] text-parchment-300">
            <Icon name="target" /> 공격 대상
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {(Object.keys(TARGET_MODE_LABEL) as TargetMode[]).map((m) => (
              <button
                key={m}
                className={`rounded-lg border-2 border-line px-1 py-1.5 text-xs transition duration-150 ease-spring ${
                  unit.targetMode === m
                    ? "-translate-y-px bg-gold-400 text-line shadow-[0_2px_0_#1b1438]"
                    : "bg-ink-950/60 text-parchment-300 hover:bg-ink-950/90"
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
            className="btn-ghost h-10 rounded-xl text-sm"
            disabled={engine.bench.length >= BENCH_SIZE}
            onClick={() => act(engine.unplaceTower(unit.uid))}
          >
            <Icon name="recall" /> 회수
          </button>
        )}
        <button
          className={`btn-red h-10 rounded-xl text-sm ${placed ? "" : "col-span-2"}`}
          onClick={() => act(engine.sellTower(unit.uid))}
        >
          <Icon name="coin" /> 판매 +{sellRefund(def.grade)}
        </button>
        {candidates > 0 && (
          <button className="btn-gold col-span-2 h-10 rounded-xl text-sm" onClick={onClose}>
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
      <div className="frame animate-pop-in rounded-2xl p-3 text-xs" style={{ transformOrigin: "bottom center" }}>
        <div className="flex items-center justify-center gap-2">
          <GradeSlot grade={a.grade} appearance={a.appearance} size={42} />
          <Icon name="plus" className="icon-toon text-lg text-parchment-50" />
          <GradeSlot grade={b.grade} appearance={b.appearance} size={42} />
          <Icon name="chevronRight" className="icon-toon text-lg text-gold-300" />
          <div
            className="flex h-[42px] w-[42px] animate-[wiggle_1.4s_ease-in-out_infinite] items-center justify-center rounded-xl border-[3px] border-line font-display text-2xl text-parchment-50 text-toon-sm"
            style={{ backgroundColor: GRADE_COLOR[next], boxShadow: "inset 0 3px 0 rgba(255,255,255,0.4), 0 3px 0 #1b1438" }}
          >
            ?
          </div>
        </div>
        <div className="mt-2 text-center text-sm">
          <span className="font-display text-toon-sm" style={{ color: GRADE_COLOR[next] }}>
            {GRADE_LABEL[next]}
          </span>
          <span className="text-parchment-100"> 등급 캐릭터 획득</span>
          <div className="text-[11px] text-parchment-300">{jackpot}% 확률로 2단계 상승</div>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <button className="btn-gold h-10 flex-1 rounded-xl text-base" onClick={onFuse}>
            <Icon name="sparkles" /> 합성
          </button>
          <button className="btn-ghost h-10 rounded-xl px-3 text-base" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
