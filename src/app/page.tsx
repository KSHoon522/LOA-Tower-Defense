"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY } from "@/game/constants";
import type { Difficulty, GameData } from "@/game/types";
import { fetchGameData } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [stageId, setStageId] = useState("");
  const [jobId, setJobId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");

  useEffect(() => {
    fetchGameData()
      .then((d) => {
        setData(d);
        if (d.chapters[0]) {
          setChapterId(d.chapters[0].id);
          if (d.chapters[0].stages[0]) setStageId(d.chapters[0].stages[0].id);
        }
        if (d.jobs[0]) setJobId(d.jobs[0].id);
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
        <h2 className="font-bold text-slate-200">4. 직업 선택</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.jobs.map((j) => (
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
