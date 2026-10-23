"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Icon, { JOB_GROUP_ICON, type IconName } from "@/components/ui/Icon";
import JobEmblem from "@/components/ui/JobEmblem";
import Sigil from "@/components/ui/Sigil";
import { DIFFICULTY } from "@/game/constants";
import type { Difficulty, EnemyDef, GameData, JobDef, JobSkill, SaveSlot } from "@/game/types";
import { fetchGameData } from "@/lib/api";
import { clearSave, loadSave } from "@/lib/save";

const PREF_KEY = "rotadi:lobby";

const DIFF_STYLE: Record<Difficulty, { color: string; icon: IconName; tagline: string }> = {
  easy: { color: "#7ee0a6", icon: "leaf", tagline: "처음이라면 여기서" },
  hard: { color: "#e6c274", icon: "swords", tagline: "합성과 시너지가 필요" },
  nightmare: { color: "#ff6b6b", icon: "skull", tagline: "한 번의 실수도 치명적" },
};

/** "1-1 해안 길" → { tag: "1-1", title: "해안 길" } */
function splitStageName(name: string, index: number) {
  const m = name.match(/^(\d+[-‐–]\d+)\s+(.*)$/);
  return m ? { tag: m[1], title: m[2] } : { tag: String(index + 1), title: name };
}

/** "챕터 1: 토토이크" → 1 (번호가 없으면 순서) */
function chapterNumber(name: string, index: number) {
  return name.match(/^챕터\s*(\d+)/)?.[1] ?? String(index + 1);
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
          <Icon name="info" className="mx-auto text-3xl text-blood-400" />
          <p className="mt-2 text-parchment-300">데이터를 불러오지 못했습니다</p>
          <p className="mt-1 text-xs text-parchment-500">{error}</p>
        </div>
      </LobbyShell>
    );
  }
  if (!data) {
    return (
      <LobbyShell>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
          <Sigil className="h-24 w-24 animate-[spin_6s_linear_infinite] text-gold-400/70" />
          <p className="font-display text-xs tracking-[0.4em] text-gold-400/80">LOADING</p>
        </div>
      </LobbyShell>
    );
  }

  const chapter = data.chapters.find((c) => c.id === chapterId);
  const stageIndex = chapter?.stages.findIndex((s) => s.id === stageId) ?? -1;
  const stage = chapter && stageIndex >= 0 ? chapter.stages[stageIndex] : undefined;
  const job = data.jobs.find((j) => j.id === jobId);
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
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-parchment-500">
          <Sigil className="h-5 w-5 text-gold-500/80" />
          <span className="font-display tracking-[0.25em]">ARKESIA DEFENSE</span>
        </div>
        <Link
          href="/editor"
          className="btn-ghost h-9 rounded-full px-3 text-xs text-parchment-300"
          title="데이터 에디터"
        >
          <Icon name="gear" className="text-sm" />
          <span className="hidden sm:inline">에디터</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-36 sm:px-6 lg:pb-32">
        {/* ===== 타이틀 ===== */}
        <section className="animate-fade-rise pb-6 pt-8 text-center sm:pt-10">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.5em] text-gold-500/80 sm:text-xs">
            Lost Ark · Random Tower Defense
          </p>
          <h1 className="mt-2 font-serif text-5xl font-black leading-none sm:text-7xl">
            <span className="text-gold-shimmer animate-shimmer">로타디</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-parchment-400">
            캐릭터를 소환하고, 합성하고, 지역 시너지를 맞춰 아크라시아를 지켜내세요
          </p>
        </section>

        {/* ===== 이어하기 ===== */}
        {save && (
          <section
            className="frame mx-auto mb-6 flex max-w-3xl animate-fade-rise flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:items-center"
            style={{ animationDelay: "80ms" }}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-ark-400 to-ark-500/0" />
            <div className="min-w-0 flex-1 pl-2">
              <div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-ark-400">
                Continue
              </div>
              <div className="mt-0.5 truncate font-serif text-lg font-bold text-parchment-50">
                {savedStage?.name ?? save.stageId}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-parchment-400">
                <span>웨이브 {save.snapshot.wave}</span>
                <span>{DIFFICULTY[save.difficulty].label}</span>
                {savedJob && <span>{savedJob.name}</span>}
                <span className="text-parchment-500">{new Date(save.savedAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2 pl-2 sm:pl-0">
              <button
                className="btn-ark h-11 flex-1 px-5 text-sm sm:flex-none"
                onClick={() => router.push("/game?resume=1")}
              >
                <Icon name="play" />
                이어하기
              </button>
              <button
                className="btn-ghost h-11 w-11 text-parchment-400 hover:text-blood-400"
                title="저장 삭제"
                aria-label="저장 삭제"
                onClick={() => {
                  if (confirm("저장된 게임을 삭제할까요?")) {
                    clearSave();
                    setSave(null);
                  }
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-12">
          {/* ===== 원정지 ===== */}
          <section
            className="frame animate-fade-rise p-4 sm:p-5 lg:col-span-7"
            style={{ animationDelay: "140ms" }}
          >
            <div className="frame-title">Expedition</div>

            {/* 챕터 */}
            {data.chapters.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {data.chapters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChapterId(c.id);
                      setStageId(c.stages[0]?.id ?? "");
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition duration-200 ${
                      chapterId === c.id
                        ? "border-gold-400/70 bg-gold-500/15 text-gold-200"
                        : "border-white/10 text-parchment-400 hover:border-gold-500/40 hover:text-parchment-100"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {chapter ? (
              <>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[11px] font-bold tracking-[0.25em] text-parchment-500">
                        CHAPTER {chapterNumber(chapter.name, data.chapters.indexOf(chapter))}
                      </span>
                      {chapter.region && (
                        <span
                          className="h-1.5 w-1.5 rotate-45"
                          style={{ backgroundColor: regionColor.get(chapter.region) ?? "#cfa24e" }}
                        />
                      )}
                    </div>
                    <h2 className="font-serif text-2xl font-bold text-parchment-50">
                      {chapter.name.replace(/^챕터\s*\d+\s*[:：]\s*/, "")}
                    </h2>
                  </div>
                  <span className="chip shrink-0">
                    <Icon name="map" /> 스테이지 {chapter.stages.length}
                  </span>
                </div>
                {chapter.description && (
                  <p className="mt-1 text-sm text-parchment-400">{chapter.description}</p>
                )}

                {/* 스테이지 경로 */}
                <div className="relative mt-6 flex items-start justify-between gap-2 px-1">
                  <div className="absolute left-8 right-8 top-6 h-px bg-gradient-to-r from-gold-500/10 via-gold-500/40 to-gold-500/10" />
                  {chapter.stages.map((s, i) => {
                    const { tag, title } = splitStageName(s.name, i);
                    const active = s.id === stageId;
                    const isBoss = !!s.bossId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStageId(s.id)}
                        className="group relative flex min-w-0 flex-1 flex-col items-center text-center"
                      >
                        <span
                          className={`relative flex h-12 w-12 items-center justify-center rotate-45 rounded-lg border transition duration-300 ease-out-expo ${
                            active
                              ? "scale-110 border-gold-300 bg-gradient-to-br from-gold-400 to-gold-700 shadow-[0_0_24px_rgba(230,194,116,0.55)]"
                              : "border-gold-500/35 bg-ink-800 group-hover:border-gold-400/70 group-hover:shadow-[0_0_14px_rgba(230,194,116,0.25)]"
                          }`}
                        >
                          <span
                            className={`-rotate-45 font-display text-sm font-bold ${
                              active ? "text-ink-950" : "text-gold-300"
                            }`}
                          >
                            {tag}
                          </span>
                        </span>
                        <span
                          className={`mt-3 w-full truncate text-sm font-semibold transition ${
                            active ? "text-gold-200" : "text-parchment-300 group-hover:text-parchment-100"
                          }`}
                        >
                          {title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-parchment-500">
                          웨이브 {s.waveDefs?.length ? s.waveDefs.length : s.waves}
                          {isBoss && <Icon name="crown" className="text-blood-400" />}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 스테이지 브리핑 */}
                {stage && (
                  <div key={stage.id} className="mt-5 animate-fade-in rounded-xl border border-white/5 bg-ink-950/50 p-3">
                    {stage.description && (
                      <p className="text-sm text-parchment-300">{stage.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {boss && (
                        <div className="flex items-center gap-2 rounded-lg border border-blood-500/30 bg-blood-600/10 py-1 pl-1 pr-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#3a0a0e] to-[#8f1d24] text-xl shadow-inner">
                            {boss.appearance.icon}
                          </span>
                          <div className="leading-tight">
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blood-400">
                              <Icon name="crown" /> Boss
                            </div>
                            <div className="text-sm font-bold text-parchment-100">{boss.name}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {foes.map((f) => (
                          <span key={f.id} className="chip py-1 text-[11px]">
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
              <p className="mt-4 text-sm text-parchment-500">
                챕터가 없습니다. 에디터에서 먼저 챕터를 만들어주세요.
              </p>
            )}

            {/* 난이도 */}
            <div className="frame-title mt-7">Difficulty</div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => {
                const st = DIFF_STYLE[d];
                const cfg = DIFFICULTY[d];
                const active = d === difficulty;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`relative overflow-hidden rounded-xl border p-2.5 text-left transition duration-300 ease-out-expo sm:p-3 ${
                      active ? "-translate-y-0.5 bg-ink-800/90" : "border-white/10 bg-ink-900/60 hover:-translate-y-0.5 hover:bg-ink-800/70"
                    }`}
                    style={{
                      borderColor: active ? st.color : undefined,
                      boxShadow: active ? `0 10px 30px -14px ${st.color}, inset 0 0 0 1px ${st.color}55` : undefined,
                    }}
                  >
                    <div
                      className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-25 blur-xl transition-opacity"
                      style={{ background: st.color, opacity: active ? 0.35 : 0.08 }}
                    />
                    <Icon name={st.icon} className="text-xl" style={{ color: st.color }} />
                    <div className="mt-1.5 font-serif text-base font-bold text-parchment-50">{cfg.label}</div>
                    <div className="hidden text-[11px] text-parchment-500 sm:block">{st.tagline}</div>
                    <div className="mt-2 space-y-0.5 text-[10px] text-parchment-400 sm:text-[11px]">
                      <div className="flex items-center gap-1">
                        <Icon name="heart" className="text-blood-400" /> 목숨 {cfg.lives}
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="skull" className="text-parchment-400" /> 적 체력 ×{cfg.enemyHpMult}
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon name="sparkles" className="text-ark-400" /> 스킬 {cfg.jobSkillUses}회
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
            <div className="frame-title">Class</div>

            {/* 직업군 문장 */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
              {groups.map((g) => {
                const active = g.name === group;
                const hasPicked = g.jobs.some((j) => j.id === jobId);
                return (
                  <button
                    key={g.name}
                    onClick={() => setGroup(g.name)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition duration-200 ease-out-expo ${
                      active
                        ? "border-gold-400/70 bg-gold-500/10 text-gold-200 shadow-[0_0_20px_-6px_rgba(230,194,116,0.6)]"
                        : "border-white/10 text-parchment-400 hover:border-gold-500/40 hover:text-parchment-100"
                    }`}
                  >
                    <Icon name={JOB_GROUP_ICON[g.name] ?? "hex"} className="text-lg" />
                    <span className="text-[11px] font-bold">{g.name}</span>
                    {hasPicked && !active && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_6px_#e6c274]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 직업 목록 */}
            <div key={group} className="mt-3 grid animate-fade-in grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {groupJobs.map((j, i) => {
                const active = j.id === jobId;
                const color = j.appearance?.color ?? "#cfa24e";
                return (
                  <button
                    key={j.id}
                    onClick={() => setJobId(j.id)}
                    className={`group flex animate-pop-in flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition duration-200 ease-out-expo ${
                      active
                        ? "-translate-y-0.5 border-gold-300/80 bg-ink-800"
                        : "border-white/5 bg-ink-950/40 hover:-translate-y-0.5 hover:border-gold-500/40"
                    }`}
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center transition duration-300 ${
                        active ? "text-gold-200" : "text-parchment-300 group-hover:text-parchment-50"
                      }`}
                      style={{
                        clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                        background: active
                          ? `linear-gradient(160deg, ${color}aa, ${color}33 70%)`
                          : `linear-gradient(160deg, ${color}66, ${color}1a 70%)`,
                      }}
                    >
                      <JobEmblem appearance={j.appearance} size={28} glow={active ? "#f3dc9c" : undefined} />
                    </span>
                    <span
                      className={`w-full truncate px-1 text-center text-xs font-bold ${
                        active ? "text-gold-200" : "text-parchment-300"
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
              <div key={job.id} className="mt-4 animate-fade-rise rounded-xl border border-white/5 bg-ink-950/50 p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center text-parchment-50"
                    style={{
                      clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                      background: `linear-gradient(160deg, ${job.appearance?.color ?? "#cfa24e"}, #0e131e 85%)`,
                    }}
                  >
                    <JobEmblem appearance={job.appearance} size={36} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-parchment-500">{jobGroup(job)}</div>
                    <div className="font-serif text-xl font-bold text-parchment-50">{job.name}</div>
                    {job.synergyRegion && (
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          color: regionColor.get(job.synergyRegion) ?? "#cfa24e",
                          borderColor: `${regionColor.get(job.synergyRegion) ?? "#cfa24e"}55`,
                        }}
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
      <div className="fixed inset-x-0 bottom-0 z-20 animate-fade-rise border-t border-gold-500/20 bg-ink-950/85 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md [animation-delay:300ms]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-parchment-400 sm:text-sm">
            <div className="truncate font-serif font-bold text-parchment-100">
              {stage?.name ?? "스테이지를 선택하세요"}
            </div>
            <div className="truncate">
              <span style={{ color: DIFF_STYLE[difficulty].color }}>{DIFFICULTY[difficulty].label}</span>
              {job && (
                <>
                  <span className="mx-1.5 text-parchment-500">·</span>
                  <JobEmblem appearance={job.appearance} size={15} className="mr-1 align-[-3px] text-parchment-100" />
                  {job.name}
                </>
              )}
            </div>
          </div>
          <button
            className={`btn-gold sheen h-12 min-w-[9.5rem] px-6 text-lg sm:h-14 sm:min-w-[12rem] sm:text-xl ${
              launching ? "scale-95 brightness-125" : "animate-glow-pulse"
            }`}
            disabled={!chapterId || !stageId}
            onClick={start}
          >
            <span className="font-serif font-black tracking-[0.2em]">출정</span>
            <Icon name="swords" className="text-xl" />
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
        className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
          active ? "bg-gold-500/20 text-gold-300" : "bg-ark-500/15 text-ark-300"
        }`}
      >
        {active ? "액티브" : "패시브"}
      </span>
      <div className="min-w-0 text-xs">
        <span className="font-bold text-parchment-100">{skill.name}</span>
        {active && skill.kind === "active" && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 text-parchment-500">
            <Icon name="hourglass" /> {skill.cooldown}초
          </span>
        )}
        <div className="text-parchment-400">{skill.description}</div>
      </div>
    </div>
  );
}

/** 로비 배경: 금빛 안개 + 천천히 도는 아크 문양 + 떠오르는 불씨 */
function LobbyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-arkesia bg-noise">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-[-20%] h-[70vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(207,162,78,0.12),transparent)] blur-2xl" />
        <div className="absolute -right-1/4 bottom-[-25%] h-[70vh] w-[70vw] animate-drift rounded-full bg-[radial-gradient(closest-side,rgba(47,201,194,0.08),transparent)] blur-2xl [animation-delay:-11s]" />
        <Sigil className="absolute left-1/2 top-[-12vh] h-[110vh] w-[110vh] -translate-x-1/2 animate-spin-slow text-gold-500/[0.07]" />
        <Sigil className="absolute left-1/2 top-[18vh] h-[50vh] w-[50vh] -translate-x-1/2 animate-spin-slow text-ark-400/[0.05] [animation-direction:reverse]" />
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="absolute bottom-[-10px] animate-rise-fade rounded-full bg-gold-300 shadow-[0_0_8px_2px_rgba(243,220,156,0.6)]"
            style={{
              left: `${e.x}%`,
              width: 4 * e.s,
              height: 4 * e.s,
              animationDelay: `${e.d}s`,
              animationDuration: `${e.t}s`,
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

const EMBERS = [
  { x: 6, d: 0, t: 11, s: 0.8 },
  { x: 14, d: 3.2, t: 9, s: 0.6 },
  { x: 23, d: 6.1, t: 12, s: 1 },
  { x: 31, d: 1.4, t: 10, s: 0.5 },
  { x: 42, d: 7.7, t: 13, s: 0.7 },
  { x: 51, d: 4.6, t: 9.5, s: 0.9 },
  { x: 60, d: 2.2, t: 11.5, s: 0.6 },
  { x: 68, d: 8.4, t: 10.5, s: 0.8 },
  { x: 77, d: 5.3, t: 12.5, s: 0.5 },
  { x: 85, d: 0.9, t: 9, s: 0.7 },
  { x: 93, d: 6.8, t: 11, s: 0.9 },
];
