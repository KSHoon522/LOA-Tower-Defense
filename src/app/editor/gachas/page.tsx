"use client";

import { useState } from "react";
import {
  EditorLayout,
  NumberField,
  SelectField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import { GRADE_LABEL, GRADE_ORDER } from "@/game/constants";
import type { GachaDef, GachaRegionMode, Grade } from "@/game/types";

function blank(): GachaDef {
  return {
    id: "",
    name: "",
    cost: 20,
    rates: { common: 40, uncommon: 30, rare: 18, hero: 9, legendary: 3 },
    regionMode: "any",
    fixedRegion: "",
    description: "",
  };
}

const REGION_MODES = [
  { value: "any", label: "전체 지역" },
  { value: "select", label: "플레이어가 지역 선택" },
  { value: "fixed", label: "특정 지역 고정" },
];

export default function GachasEditor() {
  const { items, save, remove, error, issues, clearIssues, busy } = useCrud<GachaDef>("gachas");
  const [draft, setDraft] = useState<GachaDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof GachaDef>(k: K, v: GachaDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const setRate = (grade: Grade, v: number) =>
    setDraft((d) => ({ ...d, rates: { ...d.rates, [grade]: v } }));

  const totalRate = GRADE_ORDER.reduce((s, g) => s + (draft.rates[g] ?? 0), 0);

  return (
    <EditorLayout
      title="🎲 뽑기 에디터"
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
            + 새 뽑기
          </button>
          {items.map((g) => (
            <button
              key={g.id}
              className={`btn w-full text-left text-xs ${draft.id === g.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft({ fixedRegion: "", ...structuredClone(g) });
                setIsNew(false);
              }}
            >
              🎲 {g.name} <span className="text-amber-400">{g.cost}G</span>
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="gacha-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
            <NumberField label="비용 (골드)" value={draft.cost} onChange={(v) => set("cost", v)} />
          </div>

          <fieldset className="rounded border border-slate-800 p-2">
            <legend className="px-1 text-xs font-bold text-slate-400">
              등급별 확률 가중치 — 합계 {totalRate.toFixed(1)}
              {totalRate > 0 && " (비율로 자동 정규화됨, 0 = 등장 안함)"}
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {GRADE_ORDER.map((g) => (
                <div key={g}>
                  <NumberField
                    label={GRADE_LABEL[g]}
                    value={draft.rates[g] ?? 0}
                    onChange={(v) => setRate(g, v)}
                    step={0.1}
                  />
                  {totalRate > 0 && (
                    <p className="mt-0.5 text-center text-[10px] text-slate-500">
                      {(((draft.rates[g] ?? 0) / totalRate) * 100).toFixed(2)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="지역 조건"
              value={draft.regionMode}
              onChange={(v) => set("regionMode", v as GachaRegionMode)}
              options={REGION_MODES}
            />
            {draft.regionMode === "fixed" && (
              <TextField
                label="고정 지역"
                value={draft.fixedRegion ?? ""}
                onChange={(v) => set("fixedRegion", v)}
                placeholder="슈샤이어"
              />
            )}
          </div>

          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />

          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary"
              disabled={busy || !draft.id || !draft.name || totalRate <= 0 || (draft.regionMode === "fixed" && !draft.fixedRegion)}
              onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}
            >
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
            {totalRate <= 0 && <span className="text-xs text-red-400">확률 합계가 0입니다</span>}
          </div>
        </div>
      }
    />
  );
}
