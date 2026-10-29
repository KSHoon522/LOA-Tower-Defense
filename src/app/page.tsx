"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import GradeSlot, { BOSS_PALETTE } from "@/components/ui/GradeSlot";
import Icon, { JOB_GROUP_ICON, type IconName } from "@/components/ui/Icon";
import JobEmblem from "@/components/ui/JobEmblem";
import { DIFFICULTY } from "@/game/constants";
import { floorTheme } from "@/game/themes";
import type { Difficulty, EnemyDef, GameData, JobDef, JobSkill, SaveSlot } from "@/game/types";
import { fetchGameData } from "@/lib/api";
import { clearSave, loadSave } from "@/lib/save";

const PREF_KEY = "rotadi:lobby";

/** 난이도 카드 색 (위 밝은 면 / 아래 짙은 면) */
const DIFF_STYLE: Record<Difficulty, { top: string; bottom: string; icon: IconName; tagline: string }> = {
  easy: { top: "#8fe86a", bottom: "#4cc23a", icon: "leaf", tagline: "처음이라면 여기서" },
  hard: { top: "#ffcf4a", bottom: "#f59e0b", icon: "swords", tagline: "합성과 시너지가 필요" },
  nightmare: { top: "#ff7a80", bottom: "#e5313f", icon: "skull", tagline: "한 번의 실수도 치명적" },
};

/** "1-1 해안 길" → { tag: "1-1", title: "해안 길" } (외전은 "외-1") */
function splitStageName(name: string, index: number) {
  const m = name.match(/^((?:\d+|외)[-‐–]\d+)\s+(.*)$/);
  return m ? { tag: m[1], title: m[2] } : { tag: String(index + 1), title: name };
}

/** "외전: 대양"처럼 본편 순서 밖의 챕터 */
const isSideStory = (name: string) => /^외전/.test(name);

/** "챕터 1: 토토이크" → 1, "외전: 대양" → 외 (번호가 없으면 순서) */
function chapterNumber(name: string, index: number) {
  if (isSideStory(name)) return "외";
  return name.match(/^챕터\s*(\d+)/)?.[1] ?? String(index + 1);
}

/** "챕터 1: 토토이크" → "토토이크" */
function chapterTitle(name: string) {
  return name.replace(/^(챕터\s*\d+|외전)\s*[:：]\s*/, "");
}

const NO_GROUP = "기타";
const jobGroup = (j: JobDef) => j.group?.trim() || NO_GROUP;

export default function LobbyPage() {
  const router = useRouter();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [stageId, setStageId] = useState("");
  const [jobId, setJobId] = useState("");
  const [group, setGroup] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [save, setSave] = useState<SaveSlot | null>(null);
  const [launching, setLaunching] = useState(false);
  const chapterTabsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSave(loadSave());
    fetchGameData()
      .then((d) => {
        setData(d);
        // 마지막 선택 복원 (없거나 사라진 항목이면 첫 항목)
        let pref: Partial<{ chapterId: string; stageId: string; jobId: string; difficulty: Difficulty }> = {};
        try {
          pref = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
        } catch {
          pref = {};
        }
        const chapter = d.chapters.find((c) => c.id === pref.chapterId) ?? d.chapters[0];
        if (chapter) {
          setChapterId(chapter.id);
          const stage = chapter.stages.find((s) => s.id === pref.stageId) ?? chapter.stages[0];
          if (stage) setStageId(stage.id);
        }
        const job = d.jobs.find((j) => j.id === pref.jobId) ?? d.jobs[0];
        if (job) {
          setJobId(job.id);
          setGroup(jobGroup(job));
        }
        if (pref.difficulty && pref.difficulty in DIFFICULTY) setDifficulty(pref.difficulty);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ chapterId, stageId, jobId, difficulty }));
    } catch {
      // 저장 공간을 쓸 수 없어도 로비는 그대로 동작
    }
  }, [data, chapterId, stageId, jobId, difficulty]);

  // 고른 챕터 탭이 가로 스크롤 밖에 있으면 가운데로 (세로 스크롤은 건드리지 않음)
  useEffect(() => {
    const box = chapterTabsRef.current;
    const el = box?.querySelector<HTMLElement>("[data-active]");
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [data, chapterId]);

  const enemyById = useMemo(
    () => new Map<string, EnemyDef>((data?.enemies ?? []).map((e) => [e.id, e])),
    [data]
  );
  const regionColor = useMemo(
    () => new Map((data?.synergies ?? []).map((s) => [s.region, s.color ?? "#cfa24e"])),
    [data]
  );
  const groups = useMemo(() => {
    const out: { name: string; jobs: JobDef[] }[] = [];
    for (const j of data?.jobs ?? []) {
      const g = jobGroup(j);
      let entry = out.find((o) => o.name === g);
      if (!entry) out.push((entry = { name: g, jobs: [] }));
      entry.jobs.push(j);
    }
    return out;
  }, [data]);

  if (error) {
    return (
      <LobbyShell>
        <div className="frame mx-auto mt-24 max-w-md p-6 text-center">
          <Icon name="info" className="mx-auto text-4xl text-blood-400" />
          <p className="mt-2 font-display text-xl text-parchment-50 text-toon">데이터를 불러오지 못했어요</p>
          <p className="mt-1 text-xs text-parchment-300">{error}</p>
        </div>
      </LobbyShell>
    );
  }
  if (!data) {
    return (
      <LobbyShell>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
          <div className="animate-float -rotate-3 font-display text-7xl text-gold-grad">로타디</div>
          <p className="font-display text-lg tracking-wider text-parchment-50 text-toon-sm">LOADING…</p>
        </div>
      </LobbyShell>
    );
  }

  const chapter = data.chapters.find((c) => c.id === chapterId);
  const stageIndex = chapter?.stages.findIndex((s) => s.id === stageId) ?? -1;
  const stage = chapter && stageIndex >= 0 ? chapter.stages[stageIndex] : undefined;
  // 스테이지가 많으면(군단장 레이드 6개) 동그라미를 줄여 한 줄에 담는다
  const denseStages = (chapter?.stages.length ?? 0) > 4;
  const job = data.jobs.find((j) => j.id === jobId);
  // 전장 바닥 테마: 챕터 지역, 없으면 맵 지역
  const terrain = chapter
    ? floorTheme(chapter.region ?? data.maps.find((m) => m.id === chapter.mapId)?.region)
    : undefined;
  const groupJobs = groups.find((g) => g.name === group)?.jobs ?? [];
  const boss = stage?.bossId ? enemyById.get(stage.bossId) : undefined;
  const foes = (stage?.enemyIds ?? []).map((id) => enemyById.get(id)).filter(Boolean) as EnemyDef[];

  const savedChapter = save ? data.chapters.find((c) => c.id === save.chapterId) : undefined;
  const savedStage = savedChapter?.stages.find((s) => s.id === save?.stageId);
  const savedJob = save ? data.jobs.find((j) => j.id === save.jobId) : undefined;

  const start = () => {
    if (!chapterId || !stageId) return;
    setLaunching(true);
    // 버튼 연출이 보이도록 아주 짧게 기다렸다가 이동
    window.setTimeout(() => {
      router.push(
        `/game?chapter=${encodeURIComponent(chapterId)}&stage=${encodeURIComponent(stageId)}&job=${encodeURIComponent(jobId)}&diff=${difficulty}`
      );
    }, 180);
  };

  return (
    <LobbyShell>
      {/* ===== 상단 바 ===== */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-line bg-gold-400 text-line shadow-[0_3px_0_#1b1438]">
            <Icon name="shield" className="text-base" />
          </span>
          <span className="font-display text-sm tracking-wide text-parchment-50 text-toon-sm">ARKESIA DEFENSE</span>
        </div>
        <Link href="/editor" className="btn-ghost h-10 rounded-full px-3 text-sm" title="데이터 에디터">
          <Icon name="gear" className="text-base" />
          <span className="hidden sm:inline">에디터</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-36 sm:px-6 lg:pb-32">
        {/* ===== 타이틀 ===== */}
        <section className="flex flex-col items-center pb-6 pt-6 text-center sm:pt-8">
          <div className="animate-pop-in">
            <h1 className="animate-float -rotate-3 font-display text-[5.5rem] leading-none text-gold-grad sm:text-[8rem]">
              로타디
            </h1>
          </div>
          <div
            className="-mt-1 rotate-1 animate-pop-in rounded-full border-[3px] border-line bg-blood-500 px-4 py-1 font-display text-xs tracking-wide text-parchment-50 text-toon-sm shadow-[0_4px_0_#1b1438] sm:text-sm"
            style={{ animationDelay: "120ms" }}
          >
            LOST ARK · RANDOM TOWER DEFENSE
          </div>
          <p className="mx-auto mt-4 max-w-lg text-base text-parchment-100 text-toon-sm">
            캐릭터를 소환하고, 합성하고, 지역 시너지를 맞춰 아크라시아를 지켜내세요!
          </p>
        </section>

        {/* ===== 이어하기 ===== */}
        {save && (
          <section
            className="frame mx-auto mb-6 flex max-w-3xl animate-fade-rise flex-col gap-3 p-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "80ms" }}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-line bg-leaf-400 text-line shadow-[0_3px_0_#1b1438] max-sm:hidden">
              <Icon name="flag" className="text-2xl" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-xs uppercase tracking-wider text-leaf-300 text-toon-sm">이어하기</div>
              <div className="mt-0.5 truncate font-display text-xl text-parchment-50 text-toon">
                {savedStage?.name ?? save.stageId}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span className="chip">웨이브 {save.snapshot.wave}</span>
                <span className="chip">{DIFFICULTY[save.difficulty].label}</span>
                {savedJob && <span className="chip">{savedJob.name}</span>}
                <span className="self-center text-parchment-300">{new Date(save.savedAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-green h-12 flex-1 px-6 text-lg sm:flex-none"
                onClick={() => router.push("/game?resume=1")}
              >
                <Icon name="play" />
                계속하기
              </button>
              <button
                className="btn-red h-12 w-12"
                title="저장 삭제"
                aria-label="저장 삭제"
                onClick={() => {
                  if (confirm("저장된 게임을 삭제할까요?")) {
                    clearSave();
                    setSave(null);
                  }
                }}
              >
                <Icon name="trash" className="text-lg" />
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ===== 원정지 ===== */}
          <section
            className="frame animate-fade-rise p-4 sm:p-5 lg:col-span-7"
            style={{ animationDelay: "140ms" }}
          >
            <div className="frame-title">원정지</div>

            {/* 챕터 */}
            {data.chapters.length > 1 && (
              <div ref={chapterTabsRef} className="relative -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
                {data.chapters.map((c, i) => {
                  const active = chapterId === c.id;
                  const accent = floorTheme(c.region ?? data.maps.find((m) => m.id === c.mapId)?.region).accent;
                  return (
                    <button
                      key={c.id}
                      data-active={active || undefined}
                      onClick={() => {
                        setChapterId(c.id);
                        setStageId(c.stages[0]?.id ?? "");
                      }}
                      className={`h-10 shrink-0 rounded-xl pl-1.5 pr-3 text-sm ${active ? "btn-gold" : "btn-ghost"}`}
                      title={c.name}
                    >
                      <span
                        className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-line px-1 text-xs"
                        style={{ backgroundColor: accent }}
                      >
                        {chapterNumber(c.name, i)}
                      </span>
                      {chapterTitle(c.name)}
                    </button>
                  );
                })}
              </div>
            )}

            {chapter ? (
              <>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-line px-2 py-0.5 font-display text-xs text-parchment-50 text-toon-sm shadow-[0_2px_0_#1b1438]"
                      style={{ backgroundColor: terrain?.accent ?? "#5068d0" }}
                    >
                      {isSideStory(chapter.name)
                        ? "SIDE STORY"
                        : `CHAPTER ${chapterNumber(chapter.name, data.chapters.indexOf(chapter))}`}
                    </span>
                    <h2 className="mt-1.5 truncate font-display text-3xl leading-tight text-parchment-50 text-toon">
                      {chapterTitle(chapter.name)}
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="chip">
                      <Icon name="map" /> 스테이지 {chapter.stages.length}
                    </span>
                    {terrain && (
                      <span className="chip">
                        <span
                          className="h-2.5 w-2.5 rounded-full border-2 border-line"
                          style={{ backgroundColor: terrain.accent }}
                        />
                        {terrain.label}
                      </span>
                    )}
                  </div>
                </div>
                {chapter.description && <p className="mt-1.5 text-sm text-parchment-300">{chapter.description}</p>}

                {/* 스테이지 경로: 보드게임 칸처럼 이어진 동그라미 */}
                <div className="relative mt-6 flex items-start justify-between gap-1.5 px-1 sm:gap-2">
                  {chapter.stages.length > 1 && (
                    <div
                      className={`absolute left-10 right-10 border-t-[5px] border-dotted border-line/60 ${
                        denseStages ? "top-[20px]" : "top-[26px]"
                      }`}
                    />
                  )}
                  {chapter.stages.map((s, i) => {
                    const { tag, title } = splitStageName(s.name, i);
                    const active = s.id === stageId;
                    const isBoss = !!s.bossId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStageId(s.id)}
                        className="group relative flex min-w-0 flex-1 animate-pop-in flex-col items-center text-center"
                        style={{ animationDelay: `${200 + i * 70}ms` }}
                      >
                        <span
                          className={`relative flex items-center justify-center rounded-full border-[3px] border-line transition duration-200 ease-spring ${
                            denseStages ? "h-11 w-11" : "h-14 w-14"
                          } ${
                            active ? "scale-110" : "group-hover:-translate-y-1"
                          }`}
                          style={{
                            background: active
                              ? "linear-gradient(180deg,#ffe55e 0%,#ffd83a 50%,#ffb81c 50%,#ffa90f 100%)"
                              : "linear-gradient(180deg,#5878e6 0%,#4d6bdc 50%,#3b56c6 50%,#344dba 100%)",
                            boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), 0 ${active ? 6 : 4}px 0 #1b1438${
                              active ? ", 0 0 0 4px rgba(255,255,255,0.35)" : ""
                            }`,
                          }}
                        >
                          {isBoss && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl text-gold-300 drop-shadow-[0_2px_0_#1b1438]">
                              <Icon name="crown" />
                            </span>
                          )}
                          <span
                            className={`font-display text-parchment-50 text-toon-sm ${denseStages ? "text-sm" : "text-base"}`}
                          >
                            {tag}
                          </span>
                        </span>
                        <span
                          className={`mt-3 w-full truncate font-display text-toon-sm transition ${
                            denseStages ? "text-xs" : "text-sm"
                          } ${
                            active ? "text-gold-300" : "text-parchment-100"
                          }`}
                        >
                          {title}
                        </span>
                        <span className="mt-0.5 text-[11px] text-parchment-300">
                          웨이브 {s.waveDefs?.length ? s.waveDefs.length : s.waves}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 스테이지 브리핑 */}
                {stage && (
                  <div key={stage.id} className="well mt-5 animate-pop-in p-3">
                    {stage.description && <p className="text-sm text-parchment-100">{stage.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {boss && (
                        <div className="flex items-center gap-2">
                          <GradeSlot palette={BOSS_PALETTE} appearance={boss.appearance} size={44} />
                          <div className="leading-tight">
                            <div className="flex items-center gap-1 font-display text-xs text-blood-400 text-toon-sm">
                              <Icon name="crown" /> BOSS
                            </div>
                            <div className="text-sm text-parchment-50">{boss.name}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {foes.map((f) => (
                          <span key={f.id} className="chip py-1">
                            <span className="text-sm leading-none">{f.appearance.icon}</span>
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-parchment-300">챕터가 없습니다. 에디터에서 먼저 챕터를 만들어주세요.</p>
            )}

            {/* 난이도 */}
            <div className="frame-title mt-7">난이도</div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d, i) => {
                const st = DIFF_STYLE[d];
                const cfg = DIFFICULTY[d];
                const active = d === difficulty;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`relative animate-pop-in rounded-2xl border-[3px] border-line p-2.5 text-left transition duration-200 ease-spring sm:p-3 ${
                      active ? "-translate-y-1" : "brightness-[0.8] saturate-[0.7] hover:-translate-y-0.5 hover:brightness-95"
                    }`}
                    style={{
                      animationDelay: `${260 + i * 70}ms`,
                      background: `linear-gradient(180deg, ${st.top} 0%, ${st.top} 46%, ${st.bottom} 46%, ${st.bottom} 100%)`,
                      boxShadow: `inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.15), 0 ${active ? 7 : 4}px 0 #1b1438`,
                    }}
                  >
                    {active && (
                      <span className="absolute -right-2 -top-2 flex h-7 w-7 animate-pop-in items-center justify-center rounded-full border-[3px] border-line bg-parchment-50 text-leaf-600">
                        <Icon name="check" className="text-sm" />
                      </span>
                    )}
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-line bg-parchment-50 shadow-[0_2px_0_#1b1438]">
                      <Icon name={st.icon} className="text-lg" style={{ color: st.bottom }} />
                    </span>
                    <div className="mt-1.5 font-display text-lg leading-tight text-parchment-50 text-toon sm:text-xl">
                      {cfg.label}
                    </div>
                    <div className="hidden text-xs text-parchment-50 text-toon-sm sm:block">{st.tagline}</div>
                    <div className="mt-2 space-y-1 rounded-xl bg-line/35 px-1.5 py-1 text-[11px] text-parchment-50 sm:text-xs">
                      <div className="flex items-center gap-1">
                        <Icon name="heart" className="text-blood-400" /> 목숨 {cfg.lives}
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="skull" className="text-parchment-300" /> 체력 ×{cfg.enemyHpMult}
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="sparkles" className="text-ark-300" /> 스킬 {cfg.jobSkillUses}회
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ===== 직업 ===== */}
          <section
            className="frame animate-fade-rise p-4 sm:p-5 lg:col-span-5"
            style={{ animationDelay: "220ms" }}
          >
            <div className="frame-title">직업</div>

            {/* 직업군 */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              {groups.map((g) => {
                const active = g.name === group;
                const hasPicked = g.jobs.some((j) => j.id === jobId);
                return (
                  <button
                    key={g.name}
                    onClick={() => setGroup(g.name)}
                    className={`h-14 flex-col gap-0 rounded-xl px-1 text-xs ${active ? "btn-gold" : "btn-ghost"}`}
                  >
                    <Icon name={JOB_GROUP_ICON[g.name] ?? "hex"} className="text-lg" />
                    <span className="max-w-full truncate">{g.name}</span>
                    {hasPicked && !active && (
                      <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-line bg-gold-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 직업 목록 */}
            <div key={group} className="well mt-3 grid grid-cols-3 gap-2 p-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {groupJobs.map((j, i) => {
                const active = j.id === jobId;
                const color = j.appearance?.color ?? "#5068d0";
                return (
                  <button
                    key={j.id}
                    onClick={() => setJobId(j.id)}
                    className={`group flex animate-pop-in flex-col items-center gap-1 rounded-xl px-1 py-2 transition duration-200 ease-spring ${
                      active ? "-translate-y-0.5 bg-white/15" : "hover:-translate-y-0.5 hover:bg-white/5"
                    }`}
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-line text-parchment-50 transition duration-200 ease-spring ${
                        active ? "scale-110" : "group-hover:scale-105"
                      }`}
                      style={{
                        background: `linear-gradient(180deg, ${color} 0%, ${color} 50%, color-mix(in srgb, ${color} 70%, #1b1438) 50%)`,
                        boxShadow: `inset 0 3px 0 rgba(255,255,255,0.4), 0 3px 0 #1b1438${
                          active ? ", 0 0 0 3px #ffe266" : ""
                        }`,
                      }}
                    >
                      <JobEmblem appearance={j.appearance} size={28} />
                    </span>
                    <span
                      className={`w-full truncate px-0.5 text-center text-xs text-toon-sm ${
                        active ? "text-gold-300" : "text-parchment-100"
                      }`}
                    >
                      {j.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 직업 상세 */}
            {job && (
              <div key={job.id} className="well mt-3 animate-pop-in p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-line text-parchment-50"
                    style={{
                      background: `linear-gradient(180deg, ${job.appearance?.color ?? "#5068d0"} 0%, color-mix(in srgb, ${
                        job.appearance?.color ?? "#5068d0"
                      } 60%, #1b1438) 100%)`,
                      boxShadow: "inset 0 3px 0 rgba(255,255,255,0.4), 0 3px 0 #1b1438",
                    }}
                  >
                    <JobEmblem appearance={job.appearance} size={40} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-parchment-300">{jobGroup(job)}</div>
                    <div className="font-display text-2xl leading-tight text-parchment-50 text-toon">{job.name}</div>
                    {job.synergyRegion && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 rounded-lg border-2 border-line px-1.5 py-0.5 text-[11px] text-parchment-50 text-toon-sm shadow-[0_2px_0_#1b1438]"
                        style={{ backgroundColor: regionColor.get(job.synergyRegion) ?? "#5068d0" }}
                      >
                        <Icon name="hex" /> {job.synergyRegion} 시너지 +1
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {job.skills.map((s, i) => (
                    <SkillLine key={i} skill={s} />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ===== 출정 바 ===== */}
      <div className="fixed inset-x-0 bottom-0 z-20 animate-fade-rise border-t-[3px] border-line bg-ink-900 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-6px_0_rgba(16,22,74,0.35)] [animation-delay:300ms]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs sm:text-sm">
            <div className="truncate font-display text-base text-parchment-50 text-toon-sm sm:text-lg">
              {stage?.name ?? "스테이지를 선택하세요"}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 truncate text-parchment-300">
              <span style={{ color: DIFF_STYLE[difficulty].top }}>{DIFFICULTY[difficulty].label}</span>
              {job && (
                <>
                  <span className="text-parchment-500">·</span>
                  <JobEmblem appearance={job.appearance} size={15} className="text-parchment-100" />
                  {job.name}
                </>
              )}
            </div>
          </div>
          <button
            className={`btn-gold sheen h-14 min-w-[9.5rem] rounded-[20px] px-6 text-2xl sm:h-16 sm:min-w-[13rem] sm:text-3xl ${
              launching ? "scale-90" : "animate-nudge"
            }`}
            disabled={!chapterId || !stageId}
            onClick={start}
          >
            출정!
            <Icon name="swords" className="text-2xl" />
          </button>
        </div>
      </div>
    </LobbyShell>
  );
}

function SkillLine({ skill }: { skill: JobSkill }) {
  const active = skill.kind === "active";
  return (
    <div className="flex gap-2">
      <span
        className={`mt-0.5 h-fit shrink-0 rounded-lg border-2 border-line px-1.5 py-px text-[11px] text-parchment-50 text-toon-sm ${
          active ? "bg-gold-600" : "bg-ark-500"
        }`}
      >
        {active ? "액티브" : "패시브"}
      </span>
      <div className="min-w-0 text-sm">
        <span className="text-parchment-50">{skill.name}</span>
        {active && skill.kind === "active" && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-parchment-300">
            <Icon name="hourglass" /> {skill.cooldown}초
          </span>
        )}
        <div className="text-xs text-parchment-300">{skill.description}</div>
      </div>
    </div>
  );
}

/** 로비 배경: 파란 하늘 + 천천히 흘러가는 구름 + 반짝이는 별 */
function LobbyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-arkesia">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {CLOUDS.map((c, i) => (
          <Cloud
            key={i}
            className="absolute left-0 animate-cloud"
            style={{
              top: `${c.y}%`,
              width: c.w,
              opacity: c.o,
              animationDuration: `${c.t}s`,
              animationDelay: `${c.d}s`,
            }}
          />
        ))}
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute animate-twinkle text-gold-200"
            style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, fontSize: s.s }}
          >
            <Icon name="sparkles" />
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

/** 외곽선 없는 납작한 카툰 구름 */
function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 220 90" className={className} style={style}>
      <path
        d="M30 78c-16 0-26-10-26-22s10-22 24-22c2-15 16-26 33-26 12 0 23 6 29 15 5-3 11-5 18-5 18 0 32 13 33 29 4-1 7-2 11-2 17 0 30 11 30 26s-12 25-28 25H30z"
        fill="#ffffff"
        fillOpacity="0.16"
      />
      <path d="M30 78h152c-6 4-14 6-22 6H52c-9 0-16-2-22-6z" fill="#0b1040" fillOpacity="0.12" />
    </svg>
  );
}

const CLOUDS = [
  { y: 6, w: 260, o: 1, t: 95, d: -20 },
  { y: 22, w: 180, o: 0.8, t: 120, d: -70 },
  { y: 48, w: 320, o: 0.7, t: 140, d: -35 },
  { y: 70, w: 220, o: 0.9, t: 105, d: -90 },
  { y: 86, w: 280, o: 0.6, t: 130, d: -5 },
];

const STARS = [
  { x: 8, y: 14, d: 0, s: 14 },
  { x: 22, y: 34, d: 1.1, s: 10 },
  { x: 36, y: 8, d: 0.5, s: 12 },
  { x: 64, y: 12, d: 1.7, s: 16 },
  { x: 78, y: 30, d: 0.8, s: 10 },
  { x: 91, y: 9, d: 2.1, s: 13 },
  { x: 14, y: 62, d: 1.4, s: 11 },
  { x: 88, y: 58, d: 0.3, s: 12 },
];
