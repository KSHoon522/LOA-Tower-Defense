"use client";

import { useEffect, useRef, useState } from "react";
import { NumberField, SelectField } from "@/components/editor/crud";
import { DIFFICULTY, GRADE_COLOR, GRADE_LABEL } from "@/game/constants";
import { runSimulationAsync, type SimRunResult, type SimSummary } from "@/game/simulate";
import type { Difficulty, GameData, Grade } from "@/game/types";
import { fetchGameData } from "@/lib/api";

export default function SimulatorPage() {
  const [data, setData] = useState<GameData | null>(null);
  const [chapterId, setChapterId] = useState("");
  const [stageId, setStageId] = useState("");
  const [jobId, setJobId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [runs, setRuns] = useState(20);
  const [seedBase, setSeedBase] = useState(1);
  const [prepSeconds, setPrepSeconds] = useState(1);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [live, setLive] = useState<SimRunResult[]>([]);
  const [summary, setSummary] = useState<SimSummary | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    fetchGameData().then((d) => {
      setData(d);
      if (d.chapters[0]) {
        setChapterId(d.chapters[0].id);
        setStageId(d.chapters[0].stages[0]?.id ?? "");
      }
      if (d.jobs[0]) setJobId(d.jobs[0].id);
    });
  }, []);

  const chapter = data?.chapters.find((c) => c.id === chapterId);
  const stage = chapter?.stages.find((s) => s.id === stageId);

  const start = async () => {
    if (!data || !chapter || !stage) return;
    const map = data.maps.find((m) => m.id === chapter.mapId);
    if (!map || map.paths.length === 0) {
      alert("챕터의 맵을 찾을 수 없거나 경로가 없습니다.");
      return;
    }
    setRunning(true);
    setSummary(null);
    setLive([]);
    setProgress({ done: 0, total: runs });
    stopRef.current = false;

    const result = await runSimulationAsync(
      {
        map,
        towers: data.towers,
        enemies: data.enemies,
        synergies: data.synergies,
        gachas: data.gachas,
        job: data.jobs.find((j) => j.id === jobId) ?? null,
        difficulty,
        stage,
      },
      { runs, seedBase, prepSeconds },
      (done, total, last) => {
        setProgress({ done, total });
        setLive((prev) => [...prev, last]);
      },
      () => stopRef.current
    );
    setSummary(result);
    setRunning(false);
  };

  if (!data) return <div className="panel animate-pulse">데이터 로딩 중...</div>;

  const maxWave = summary ? Math.max(...summary.results.map((r) => r.totalWaves), 1) : 0;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-amber-400">🧪 밸런스 시뮬레이터</h1>
      <p className="text-xs text-slate-400">
        자동 플레이 AI(가장 싼 뽑기 → 가치 높은 타일 배치 → 즉시 합성 → 상황별 직업 스킬)가 스테이지를 N회
        플레이합니다. 같은 시드는 항상 같은 결과이므로 밸런스 변경 전후 비교에 사용하세요.
      </p>

      <div className="panel grid grid-cols-2 gap-2 md:grid-cols-4">
        <SelectField
          label="챕터"
          value={chapterId}
          onChange={(v) => {
            setChapterId(v);
            setStageId(data.chapters.find((c) => c.id === v)?.stages[0]?.id ?? "");
          }}
          options={data.chapters.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          label="스테이지"
          value={stageId}
          onChange={setStageId}
          options={(chapter?.stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
        <SelectField
          label="난이도"
          value={difficulty}
          onChange={(v) => setDifficulty(v as Difficulty)}
          options={(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY[d].label }))}
        />
        <SelectField
          label="직업"
          value={jobId}
          onChange={setJobId}
          options={[{ value: "", label: "(없음)" }, ...data.jobs.map((j) => ({ value: j.id, label: j.name }))]}
        />
        <NumberField label="실행 횟수" value={runs} onChange={(v) => setRuns(Math.max(1, Math.min(200, v)))} />
        <NumberField label="시작 시드" value={seedBase} onChange={setSeedBase} />
        <NumberField label="준비 시간(초/웨이브)" value={prepSeconds} onChange={setPrepSeconds} step={0.5} />
        <div className="flex items-end gap-2">
          {!running ? (
            <button className="btn btn-primary w-full" onClick={start} disabled={!stage}>
              ▶ 시뮬레이션 시작
            </button>
          ) : (
            <button className="btn btn-danger w-full" onClick={() => (stopRef.current = true)}>
              ■ 중지
            </button>
          )}
        </div>
      </div>

      {progress && (
        <div className="panel">
          <div className="flex justify-between text-xs text-slate-400">
            <span>진행 {progress.done}/{progress.total}</span>
            <span>
              현재 클리어율{" "}
              {live.length > 0
                ? Math.round((live.filter((r) => r.phase === "victory").length / live.length) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded bg-slate-800">
            <div
              className="h-2 rounded bg-amber-500 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label="클리어율" value={`${Math.round(summary.clearRate * 100)}%`} accent={summary.clearRate >= 0.5} />
            <Stat label="평균 도달 웨이브" value={`${summary.avgWave.toFixed(1)} / ${maxWave}`} />
            <Stat label="평균 남은 목숨" value={summary.avgLives.toFixed(1)} />
            <Stat label="평균 종료 골드" value={Math.round(summary.avgGold).toLocaleString()} />
            <Stat label="평균 소요(게임초)" value={Math.round(summary.avgSeconds).toLocaleString()} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* 웨이브별 패배 분포 */}
            <div className="panel">
              <h3 className="mb-2 text-sm font-bold text-slate-200">웨이브별 패배 분포</h3>
              {Object.keys(summary.defeatByWave).length === 0 ? (
                <p className="text-xs text-slate-500">패배한 런이 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {Array.from({ length: maxWave }, (_, i) => i + 1)
                    .filter((w) => summary.defeatByWave[w])
                    .map((w) => (
                      <div key={w} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-slate-400">웨이브 {w}</span>
                        <div className="h-3 flex-1 rounded bg-slate-800">
                          <div
                            className="h-3 rounded bg-red-500"
                            style={{ width: `${(summary.defeatByWave[w] / summary.runs) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-slate-300">{summary.defeatByWave[w]}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* 캐릭터 기여도 */}
            <div className="panel">
              <h3 className="mb-2 text-sm font-bold text-slate-200">캐릭터 평균 딜량 비중 (상위 10)</h3>
              <div className="space-y-1">
                {summary.topTowers.map((t) => (
                  <div key={t.defId} className="flex items-center gap-2 text-xs">
                    <span
                      className="rounded px-1 text-[9px] font-bold text-slate-950"
                      style={{ backgroundColor: GRADE_COLOR[t.grade as Grade] }}
                    >
                      {GRADE_LABEL[t.grade as Grade]}
                    </span>
                    <span className="w-32 truncate">{t.name}</span>
                    <div className="h-3 flex-1 rounded bg-slate-800">
                      <div
                        className="h-3 rounded"
                        style={{
                          width: `${t.avgShare * 100}%`,
                          backgroundColor: GRADE_COLOR[t.grade as Grade],
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-slate-300">{(t.avgShare * 100).toFixed(1)}%</span>
                    <span className="w-12 text-right text-slate-500">{t.appearances}회</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 런별 결과 */}
          <div className="panel overflow-x-auto">
            <h3 className="mb-2 text-sm font-bold text-slate-200">런별 결과</h3>
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left">시드</th>
                  <th className="px-2 py-1 text-left">결과</th>
                  <th className="px-2 py-1 text-right">웨이브</th>
                  <th className="px-2 py-1 text-right">목숨</th>
                  <th className="px-2 py-1 text-right">골드</th>
                  <th className="px-2 py-1 text-left">MVP</th>
                </tr>
              </thead>
              <tbody>
                {summary.results.map((r) => (
                  <tr key={r.seed} className="border-t border-slate-800">
                    <td className="px-2 py-1 font-mono">{r.seed}</td>
                    <td className={`px-2 py-1 ${r.phase === "victory" ? "text-green-400" : r.phase === "defeat" ? "text-red-400" : "text-slate-400"}`}>
                      {r.phase === "victory" ? "승리" : r.phase === "defeat" ? "패배" : "시간초과"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {r.wave}/{r.totalWaves}
                    </td>
                    <td className="px-2 py-1 text-right">{r.lives}</td>
                    <td className="px-2 py-1 text-right">{r.gold.toLocaleString()}</td>
                    <td className="px-2 py-1 text-slate-300">{r.towers[0]?.name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel text-center">
      <div className={`text-xl font-extrabold ${accent ? "text-green-400" : "text-amber-400"}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}
