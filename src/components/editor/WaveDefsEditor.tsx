"use client";

import { SPAWN_INTERVAL, WAVES_PER_BOSS, WAVE_ENEMY_COUNT } from "@/game/constants";
import type { EnemyDef, StageDef, WaveDef, WaveGroup } from "@/game/types";
import { NumberField, SelectField, TextField } from "./crud";

/** 자동 생성 규칙과 동일한 구성으로 수동 웨이브 초안 생성 */
export function generateWaveDefs(stage: StageDef, enemies: EnemyDef[]): WaveDef[] {
  const normals = enemies.filter((e) => !e.isBoss);
  const pool =
    stage.enemyIds.length > 0
      ? stage.enemyIds.filter((id) => normals.some((e) => e.id === id))
      : normals.map((e) => e.id);
  const bosses = enemies.filter((e) => e.isBoss);
  const bossId = stage.bossId || bosses[0]?.id;

  const result: WaveDef[] = [];
  for (let w = 1; w <= stage.waves; w++) {
    const isBoss = (w % WAVES_PER_BOSS === 0 || w === stage.waves) && !!bossId;
    if (isBoss) {
      result.push({ groups: [], bossId, description: `보스 웨이브` });
      continue;
    }
    // 자동 생성은 적을 순환 배치 → 종류별 개수로 요약
    const counts = new Map<string, number>();
    for (let i = 0; i < WAVE_ENEMY_COUNT; i++) {
      const id = pool[(w + i) % pool.length];
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    result.push({
      groups: Array.from(counts.entries()).map(([enemyId, count]) => ({
        enemyId,
        count,
        interval: SPAWN_INTERVAL,
      })),
    });
  }
  return result;
}

function GroupRow({
  group,
  enemies,
  onChange,
  onRemove,
}: {
  group: WaveGroup;
  enemies: EnemyDef[];
  onChange: (g: WaveGroup) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      <div className="w-44">
        <SelectField
          label="적"
          value={group.enemyId}
          onChange={(v) => onChange({ ...group, enemyId: v })}
          options={enemies.map((e) => ({ value: e.id, label: `${e.appearance.icon} ${e.name}` }))}
        />
      </div>
      <div className="w-16">
        <NumberField label="수" value={group.count} onChange={(v) => onChange({ ...group, count: v })} />
      </div>
      <div className="w-20">
        <NumberField label="간격(초)" value={group.interval} onChange={(v) => onChange({ ...group, interval: v })} step={0.1} />
      </div>
      <div className="w-20">
        <NumberField label="지연(초)" value={group.delay ?? 0} onChange={(v) => onChange({ ...group, delay: v })} step={0.5} />
      </div>
      <button className="btn" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

export default function WaveDefsEditor({
  stage,
  enemies,
  onChange,
}: {
  stage: StageDef;
  enemies: EnemyDef[];
  onChange: (waveDefs: WaveDef[] | undefined) => void;
}) {
  const normals = enemies.filter((e) => !e.isBoss);
  const bosses = enemies.filter((e) => e.isBoss);
  const defs = stage.waveDefs;

  if (!defs) {
    return (
      <div className="rounded border border-dashed border-slate-700 p-2 text-[11px] text-slate-400">
        현재 <b>자동 생성 모드</b>입니다 (등장 적 순환 배치, {WAVES_PER_BOSS}의 배수/마지막 웨이브에 보스).
        <button className="btn ml-2 text-xs" onClick={() => onChange(generateWaveDefs(stage, enemies))}>
          수동 웨이브로 전환 (자동 구성 복사)
        </button>
      </div>
    );
  }

  const updateWave = (i: number, w: WaveDef) => onChange(defs.map((x, xi) => (xi === i ? w : x)));

  return (
    <div className="space-y-2 rounded border border-amber-800/50 bg-amber-950/10 p-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-bold text-amber-300">수동 웨이브 모드 — 총 {defs.length}웨이브</span>
        <button
          className="btn ml-auto text-xs"
          onClick={() => onChange([...defs, { groups: [{ enemyId: normals[0]?.id ?? "", count: 8, interval: SPAWN_INTERVAL }] }])}
        >
          + 웨이브 추가
        </button>
        <button
          className="btn text-xs"
          onClick={() => {
            if (confirm("자동 생성 구성으로 다시 채울까요? 현재 수동 구성은 사라집니다.")) {
              onChange(generateWaveDefs(stage, enemies));
            }
          }}
        >
          자동 구성으로 재생성
        </button>
        <button
          className="btn btn-danger text-xs"
          onClick={() => {
            if (confirm("수동 웨이브를 삭제하고 자동 생성 모드로 돌아갈까요?")) onChange(undefined);
          }}
        >
          자동 모드로
        </button>
      </div>

      {defs.map((w, i) => (
        <div key={i} className="rounded border border-slate-700 bg-slate-900/70 p-2">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-xs font-bold text-slate-200">웨이브 {i + 1}</span>
            <div className="w-44">
              <SelectField
                label="보스"
                value={w.bossId ?? ""}
                onChange={(v) => updateWave(i, { ...w, bossId: v || undefined })}
                options={[
                  { value: "", label: "(없음 = 일반 웨이브)" },
                  ...bosses.map((b) => ({ value: b.id, label: `${b.appearance.icon} ${b.name}` })),
                ]}
              />
            </div>
            <div className="w-20">
              <NumberField label="체력 ×" value={w.hpMult ?? 1} onChange={(v) => updateWave(i, { ...w, hpMult: v })} step={0.1} />
            </div>
            <div className="w-20">
              <NumberField label="골드 ×" value={w.goldMult ?? 1} onChange={(v) => updateWave(i, { ...w, goldMult: v })} step={0.1} />
            </div>
            <div className="min-w-40 flex-1">
              <TextField label="메모" value={w.description ?? ""} onChange={(v) => updateWave(i, { ...w, description: v })} />
            </div>
            <button
              className="btn"
              title="위로"
              disabled={i === 0}
              onClick={() => {
                const next = [...defs];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              ↑
            </button>
            <button
              className="btn"
              title="아래로"
              disabled={i === defs.length - 1}
              onClick={() => {
                const next = [...defs];
                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                onChange(next);
              }}
            >
              ↓
            </button>
            <button className="btn btn-danger" onClick={() => onChange(defs.filter((_, xi) => xi !== i))}>
              삭제
            </button>
          </div>

          <div className="mt-2 space-y-1.5 pl-2">
            {w.groups.map((g, gi) => (
              <GroupRow
                key={gi}
                group={g}
                enemies={normals}
                onChange={(ng) => updateWave(i, { ...w, groups: w.groups.map((x, xi) => (xi === gi ? ng : x)) })}
                onRemove={() => updateWave(i, { ...w, groups: w.groups.filter((_, xi) => xi !== gi) })}
              />
            ))}
            <button
              className="btn text-xs"
              onClick={() =>
                updateWave(i, {
                  ...w,
                  groups: [...w.groups, { enemyId: normals[0]?.id ?? "", count: 5, interval: SPAWN_INTERVAL }],
                })
              }
            >
              + 스폰 그룹
            </button>
            {w.groups.length === 0 && !w.bossId && (
              <span className="ml-2 text-[10px] text-red-400">적이 없는 웨이브입니다</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
