"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY } from "@/game/constants";
import type { Difficulty, GameData, JobDef, SaveSlot } from "@/game/types";
import { fetchGameData } from "@/lib/api";
import { clearSave, loadSave } from "@/lib/save";

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [stageId, setStageId] = useState("");
  const [jobId, setJobId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [save, setSave] = useState<SaveSlot | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSave(loadSave());
    fetchGameData()
      .then((d) => {
        setData(d);
        if (d.chapters[0]) {
          setChapterId(d.chapters[0].id);
          if (d.chapters[0].stages[0]) setStageId(d.chapters[0].stages[0].id);
        }
        if (d.jobs[0]) {
          setJobId(d.jobs[0].id);
          setOpenGroups(new Set([jobGroup(d.jobs[0])]));
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="panel text-red-400">데이터 로딩 실패: {error}</div>;
  }
  if (!data) {
    return <div className="panel animate-pulse">게임 데이터 로딩 중...</div>;
  }

  const chapter = data.chapters.find((c) => c.id === chapterId);
  const selectedJob = data.jobs.find((j) => j.id === jobId);
  const jobGroups = groupJobs(data.jobs);
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-amber-400">
          로스트아크 랜덤 타워 디펜스
        </h1>
        <p className="mt-1 text-slate-400">
          타워를 뽑고, 합성하고, 시너지를 맞춰 적의 침공을 막아내세요!
        </p>
      </div>

      {save && (
        <section className="panel flex items-center gap-3 border-green-700 bg-green-950/30">
          <div className="flex-1 text-sm">
            <div className="font-bold text-green-300">💾 저장된 게임이 있습니다</div>
            <div className="text-xs text-slate-400">
              {data.chapters.find((c) => c.id === save.chapterId)?.name ?? save.chapterId} ·{" "}
              {data.chapters
                .find((c) => c.id === save.chapterId)
                ?.stages.find((s) => s.id === save.stageId)?.name ?? save.stageId}{" "}
              · 웨이브 {save.snapshot.wave} · {DIFFICULTY[save.difficulty].label} ·{" "}
              {new Date(save.savedAt).toLocaleString()}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/game?resume=1")}
          >
            이어하기
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm("저장된 게임을 삭제할까요?")) {
                clearSave();
                setSave(null);
              }
            }}
          >
            삭제
          </button>
        </section>
      )}

      <section className="panel space-y-2">
        <h2 className="font-bold text-slate-200">1. 챕터 선택</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setChapterId(c.id);
                setStageId(c.stages[0]?.id ?? "");
              }}
              className={`btn text-left ${chapterId === c.id ? "border-amber-500 bg-amber-500/10" : ""}`}
            >
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-slate-400">
                {c.region ? `${c.region} · ` : ""}스테이지 {c.stages.length}개
              </div>
            </button>
          ))}
          {data.chapters.length === 0 && (
            <p className="text-sm text-slate-500">
              챕터가 없습니다. 에디터에서 먼저 챕터를 만들어주세요.
            </p>
          )}
        </div>
      </section>

      {chapter && (
        <section className="panel space-y-2">
          <h2 className="font-bold text-slate-200">2. 스테이지 선택</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {chapter.stages.map((s) => (
              <button
                key={s.id}
                onClick={() => setStageId(s.id)}
                className={`btn text-left ${stageId === s.id ? "border-amber-500 bg-amber-500/10" : ""}`}
              >
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-slate-400">
                  웨이브 {s.waves} · 적 {s.enemyIds.length}종
                </div>
              </button>
            ))}
            {chapter.stages.length === 0 && (
              <p className="text-sm text-slate-500">이 챕터에 스테이지가 없습니다.</p>
            )}
          </div>
        </section>
      )}

      <section className="panel space-y-2">
        <h2 className="font-bold text-slate-200">3. 난이도 선택</h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`btn ${difficulty === d ? "border-amber-500 bg-amber-500/10" : ""}`}
            >
              <div className="font-semibold">{DIFFICULTY[d].label}</div>
              <div className="text-xs text-slate-400">
                목숨 {DIFFICULTY[d].lives} · 적 체력 ×{DIFFICULTY[d].enemyHpMult} · 스킬{" "}
                {DIFFICULTY[d].jobSkillUses}회
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="panel space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-bold text-slate-200">4. 직업 선택</h2>
          {selectedJob && (
            <span className="text-sm text-amber-300">
              선택: {selectedJob.appearance?.icon} {selectedJob.name}
            </span>
          )}
        </div>
        {jobGroups.map(({ group, jobs }) => {
          const open = openGroups.has(group);
          const hasSelected = jobs.some((j) => j.id === jobId);
          return (
            <div key={group} className="rounded border border-slate-800">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/50"
              >
                <span className="w-3 text-sm text-slate-400">{open ? "▾" : "▸"}</span>
                <span className="font-semibold text-slate-200">{group}</span>
                <span className="text-xs text-slate-500">{jobs.length}</span>
                <span className="ml-auto truncate text-xs text-slate-400">
                  {hasSelected
                    ? `✔ ${selectedJob?.name}`
                    : jobs.map((j) => j.appearance?.icon ?? "").join(" ")}
                </span>
              </button>
              {open && (
                <div className="grid gap-2 p-2 pt-0 sm:grid-cols-2">
                  {jobs.map((j) => (
                    <button
                      key={j.id}
                      onClick={() => setJobId(j.id)}
                      className={`btn text-left ${jobId === j.id ? "border-amber-500 bg-amber-500/10" : ""}`}
                    >
                      <div className="font-semibold">
                        {j.appearance?.icon} {j.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">{j.description}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {j.skills.map((s, i) => (
                          <span
                            key={i}
                            className={`rounded px-1 py-0.5 text-[9px] ${
                              s.kind === "active"
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {s.kind === "active" ? "액티브" : "패시브"} {s.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {selectedJob?.synergyRegion && (
          <p className="text-xs text-amber-400/80">
            선택 시 [{selectedJob.synergyRegion}] 지역 시너지 카운트 +1
          </p>
        )}
      </section>

      <button
        className="btn btn-primary w-full py-3 text-lg font-bold"
        disabled={!chapterId || !stageId}
        onClick={() =>
          router.push(
            `/game?chapter=${encodeURIComponent(chapterId)}&stage=${encodeURIComponent(stageId)}&job=${encodeURIComponent(jobId)}&diff=${difficulty}`
          )
        }
      >
        게임 시작
      </button>
    </div>
  );
}

const NO_GROUP = "기타";

function jobGroup(j: JobDef): string {
  return j.group?.trim() || NO_GROUP;
}

/** 직업군별로 묶기 (데이터 순서대로, 직업군이 없으면 "기타") */
function groupJobs(jobs: JobDef[]): { group: string; jobs: JobDef[] }[] {
  const out: { group: string; jobs: JobDef[] }[] = [];
  for (const j of jobs) {
    const g = jobGroup(j);
    let entry = out.find((o) => o.group === g);
    if (!entry) {
      entry = { group: g, jobs: [] };
      out.push(entry);
    }
    entry.jobs.push(j);
  }
  return out;
}
