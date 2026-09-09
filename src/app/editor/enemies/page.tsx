"use client";

import { useState } from "react";
import AppearanceFields from "@/components/editor/AppearanceFields";
import TraitFields from "@/components/editor/TraitFields";
import {
  CheckField,
  EditorLayout,
  NumberField,
  TextField,
  useCrud,
} from "@/components/editor/crud";
import type { EnemyDef } from "@/game/types";

function blank(): EnemyDef {
  return {
    id: "",
    name: "",
    hp: 100,
    defense: 10,
    magicDefense: 10,
    moveSpeed: 1.2,
    isBoss: false,
    goldReward: 5,
    traits: [],
    appearance: { color: "#84cc16", shape: "circle", icon: "👹" },
    description: "",
  };
}

export default function EnemiesEditor() {
  const { items, save, remove, error, busy } = useCrud<EnemyDef>("enemies");
  const [draft, setDraft] = useState<EnemyDef>(blank());
  const [isNew, setIsNew] = useState(true);

  const set = <K extends keyof EnemyDef>(k: K, v: EnemyDef[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <EditorLayout
      title="👹 적 캐릭터 에디터"
      error={error}
      list={
        <div className="space-y-1">
          <button
            className="btn btn-primary mb-2 w-full"
            onClick={() => {
              setDraft(blank());
              setIsNew(true);
            }}
          >
            + 새 적
          </button>
          {items.map((e) => (
            <button
              key={e.id}
              className={`btn w-full text-left text-xs ${draft.id === e.id && !isNew ? "border-amber-500" : ""}`}
              onClick={() => {
                setDraft(structuredClone(e));
                setIsNew(false);
              }}
            >
              {e.appearance.icon} {e.name}{" "}
              {e.isBoss && <span className="text-red-400">[보스]</span>}
            </button>
          ))}
        </div>
      }
      form={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <TextField label="ID (고유값)" value={draft.id} onChange={(v) => set("id", v)} placeholder="en-xxx" disabled={!isNew} />
            <TextField label="이름" value={draft.name} onChange={(v) => set("name", v)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <NumberField label="체력" value={draft.hp} onChange={(v) => set("hp", v)} />
            <NumberField label="방어력" value={draft.defense} onChange={(v) => set("defense", v)} />
            <NumberField label="마법 방어력" value={draft.magicDefense} onChange={(v) => set("magicDefense", v)} />
            <NumberField label="이동속도 (타일/초)" value={draft.moveSpeed} onChange={(v) => set("moveSpeed", v)} step={0.1} />
            <NumberField label="처치 골드" value={draft.goldReward} onChange={(v) => set("goldReward", v)} />
          </div>
          <CheckField label="보스 여부 (보스 웨이브에 단독 등장, 체력 대폭 증가)" value={draft.isBoss} onChange={(v) => set("isBoss", v)} />
          <TraitFields
            value={draft.traits ?? []}
            onChange={(v) => set("traits", v)}
            enemies={items.filter((e) => e.id !== draft.id)}
          />
          <AppearanceFields value={draft.appearance} onChange={(v) => set("appearance", v)} />
          <TextField label="설명" value={draft.description ?? ""} onChange={(v) => set("description", v)} />
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy || !draft.id || !draft.name} onClick={() => save(draft, isNew).then((ok) => ok && setIsNew(false))}>
              {isNew ? "생성" : "수정 저장"}
            </button>
            {!isNew && (
              <button className="btn btn-danger" disabled={busy} onClick={() => remove(draft.id).then((ok) => { if (ok) { setDraft(blank()); setIsNew(true); } })}>
                삭제
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}
