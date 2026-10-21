"use client";

import { useState } from "react";
import {
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { MISSION_CONDITION_LABEL, describeMissionCondition } from "@/game/constants";
import type {
  MissionCondition,
  MissionConditionType,
  MissionDef,
  MissionWaveFilter,
} from "@/game/types";

function blank(): MissionDef {
  return {
    id: "",
    name: "",
    condition: { type: "no_leak" },
    rewardGold: 15,
    waveFilter: "any",
    description: "",
  };
}

/** 조건 종류를 바꿀 때 필요한 기본 파라미터 채우기 */
function defaultCondition(type: MissionConditionType): MissionCondition {
  switch (type) {
    case "clear_within":
      return { type, seconds: 35 };
    case "max_placed":
      return { type, count: 4 };
    case "boss_within":
      return { type, seconds: 30 };
    default:
      return { type };
  }
}

const WAVE_FILTERS = [
  { value: "any", label: "모든 웨이브" },
  { value: "normal", label: "일반 웨이브만" },
  { value: "boss", label: "보스 웨이브만" },
];

export default function MissionsEditor() {
  const { items, save, remove, error, issues, clearIssues, busy } = useCrud<MissionDef>("missions");
  const [draft, setDraft] = useState<MissionDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof MissionDef>(k: K, v: MissionDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const c = draft.condition;

  return (
    <EditorLayout
      title="🎯 웨이브 미션 에디터"
      error={error}
      issues={issues}
      onDismiss={clearIssues}
      list={
        <div className="space-y-1">
          <button
            className="btn btn-primary mb-2 w-full"
            onClick={() => {
              setDraft(blank());
              setIsNew(true);
            }}
          >
            + 새 미션
          </button>
          {items.map((m) => (
            <button
              key={m.id}
              className={`btn w-full text-left text-xs ${draft.id === m.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(m));
                setIsNew(false);
              }}
            >
              🎯 {m.name} <span className="text-amber-400">+{m.rewardGold}G</span>
              <span className="block text-[10px] text-slate-500">{describeMissionCondition(m.condition)}</span>
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <p className="text-[11px] text-slate-400">
            웨이브를 시작할 때 조건에 맞는 미션 중 하나가 배정되고(같은 시드면 같은 미션), 적을
            전멸시키는 순간 판정합니다. 조기 호출로 이어 붙인 웨이브에는 새 미션이 붙지 않습니다.
            수동 웨이브에서는 챕터 에디터에서 웨이브별 미션을 고정할 수 있습니다.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="mi-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
            <NumberField label="성공 보상 (골드)" value={draft.rewardGold} onChange={(v) => set("rewardGold", v)} />
          </div>

          <fieldset className="rounded border border-slate-800 p-2">
            <legend className="px-1 text-xs font-bold text-slate-400">성공 조건</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <SelectField
                label="조건"
                value={c.type}
                onChange={(v) => set("condition", defaultCondition(v as MissionConditionType))}
                options={(Object.keys(MISSION_CONDITION_LABEL) as MissionConditionType[]).map((t) => ({
                  value: t,
                  label: MISSION_CONDITION_LABEL[t],
                }))}
              />
              {(c.type === "clear_within" || c.type === "boss_within") && (
                <NumberField
                  label="제한 시간 (초)"
                  value={c.seconds}
                  onChange={(v) => set("condition", { ...c, seconds: v })}
                />
              )}
              {c.type === "max_placed" && (
                <NumberField
                  label="최대 배치 수"
                  value={c.count}
                  onChange={(v) => set("condition", { ...c, count: v })}
                />
              )}
            </div>
            {c.type === "boss_within" && (
              <p className="mt-1 text-[10px] text-slate-500">보스 처치 미션은 보스 웨이브에만 배정됩니다.</p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="등장 웨이브"
              value={draft.waveFilter}
              onChange={(v) => set("waveFilter", v as MissionWaveFilter)}
              options={WAVE_FILTERS}
            />
            <NumberField
              label="최소 웨이브 (이 웨이브부터 등장)"
              value={draft.minWave ?? 1}
              onChange={(v) => set("minWave", v > 1 ? v : undefined)}
            />
          </div>

          <TextField label="설명 (게임 화면 표시)" value={draft.description ?? ""} onChange={(v) => set("description", v)} />

          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary"
              disabled={busy || !draft.id || !draft.name}
              onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}
            >
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={() =>
                  remove(draft.id).then((ok) => {
                    if (ok) {
                      setDraft(blank());
                      setIsNew(true);
                    }
                  })
                }
              >
                삭제
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}
